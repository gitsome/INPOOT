/**
 * inpoot.js
 * @author john martin / johndavidfive@gmail.com / johndavidfive.com
 * Accepts a list of actions and number of max players and other options
 * Provides an optional UI to allow the user to configure keyboard / mouse / gamepad inputs to those actions
 * Provides an api to gather input values that are mapped to the configured actions
 */

/*global alert, console*/

//the namespace
var inpoot = {};

(function($) {
    "use strict";

    //========================================================================================================
    //                   INITIALIZATION, GLOBAL VARIABLES, AND ACTUAL GAME LOOP FUNCTIONALITY
    //========================================================================================================


    /*======== SOME CROSS BROWSER LOGIC FROM GAMEPAD.JS ========*/

    var contains = function(lookIn, forWhat) { return lookIn.indexOf(forWhat) != -1; };
    var userAgent = navigator.userAgent;
    var isWindows = contains(userAgent, 'Windows NT');
    var isMac = contains(userAgent, 'Macintosh');
    var isChrome = contains(userAgent, 'Chrome/');
    var isFirefox = contains(userAgent, 'Firefox/');
    var currentKeyboard = {};

    if (isFirefox) {
        // todo; current moz nightly does not define this, so we'll always
        // return true for .supported on that Firefox.
        navigator.mozGamepads = [];
        var mozConnectHandler = function(e) {
            navigator.mozGamepads[e.gamepad.index] = e.gamepad;
        };
        var mozDisconnectHandler = function(e) {
            navigator.mozGamepads[e.gamepad.index] = undefined;
        };
        window.addEventListener("MozGamepadConnected", mozConnectHandler);
        window.addEventListener("MozGamepadDisconnected", mozDisconnectHandler);
    }

    var mapPad = function(raw) {

        for (var gpadType in inpoot.gamepads) {

            var entry = inpoot.gamepads[gpadType];
            var idMatches = entry.idMatches;

            for(var j=0; j < idMatches.length; j++){
                var thisMatch = idMatches[j];

                var isMatch = true;
                for (var k=0; k < thisMatch.length; k++){
                     if (!contains(raw.id, thisMatch[k])) {
                        isMatch = false;
                     }
                }

                if(isMatch) {
                    raw.displayName = entry.displayName;
                    raw.gpadType = gpadType;
                    return;
                }

            }
        }

        raw.gpadType = raw.id;
        raw.displayName = "Unknown gamepad";
    };


    /*======== ADDITIONAL GLOBALS ========*/

    var gamepads = {};
    var actions = {};               //just the actions... need to be passed in during initalization
    var gamepadmaps = {};           //object containing configurations for gamepad types
    var lastState = {};             // a copy of the current state used for changes
    var currentState = {};          //holds event driven key state (keyboard mostly / mouse)
    var uiOpen = false;             //this flag helps the plugin stop tick events except for internal use when the UI is open
    var mouseMoved = 0;             //a flag to help us with tracking the mouse values
    var defaultPlayers = false;     //if the user sends these in during initalization or externally we want to hold on to them in case inpoot.resetConfigs is called
    var defaultMappings = false;    //if the user sends these in during initalization or externally we want to hold on to them in case inpoot.resetConfigs is called

    //here are some values that can be set publicly
    var maxPlayers = 1; //by default you have to have one player
    var mouseNormalizer; //number of pixels that max out the mouse input to 1

    // Current Inputs
    var CI = {
        'mouse':{},
        'keyboard' : {},
        'gamepad' : {}
    };

    // Last Inputs
    var LI = {};


    /*========= LISTENER DRIVEN FUNCTIONS ========*/

    var onKeyDown = function (e) {
        currentKeyboard[e.keyCode] = 1;
    };

    var onKeyUp = function (e) {
        currentKeyboard[e.keyCode] = 0;
    };

    var mousemap = {
        1 : 'mouse_button_left',
        2 : 'mouse_button_middle',
        3 : 'mouse_button_right'
    };

    var onMouseDown = function (e) {
        CI['mouse'][mousemap[e.which]] = 1;
    };

    var onMouseUp = function (e) {
        CI['mouse'][mousemap[e.which]] = 0;
    };

    var onMouseMove = function (e) {

        //set the mouse move flag to 0
        mouseMoved = 0;

        var movementX = e.movementX ||
            e.mozMovementX    ||
            e.webkitMovementX || 0;

        var movementY = e.movementY ||
            e.mozMovementY    ||
            e.webkitMovementY ||  0;

        //If we get these then let's use them (a must when pointer lock is on)
        if(movementX || movementY){

            CI['mouse']['mouseDX'] = movementX;
            CI['mouse']['mouseDY'] = movementY;

        } else {

            CI['mouse']['mouseXL'] = CI['mouse']['mouseX'];
            CI['mouse']['mouseYL'] = CI['mouse']['mouseY'];
            CI['mouse']['mouseX'] = ( e.clientX / window.innerWidth  ) * 2 - 1;
            CI['mouse']['mouseY'] = ( e.clientY / window.innerHeight ) * 2 - 1;
            CI['mouse']['mouseDX'] = CI['mouse']['mouseX'] - CI['mouse']['mouseXL'];
            CI['mouse']['mouseDY'] = CI['mouse']['mouseY'] - CI['mouse']['mouseYL'];
        }
    };

    //this just returns the raw gamepad objects
    var getRawPads = function () {
        return navigator.webkitGamepads || navigator.mozGamepads || navigator.gamepads;
    };

    //this is used if you want to return an array of active gamepads (somewhat filtered with added attributes)
    var getGamePads = function () {
        var gamePadList = [];
        var tempList = getRawPads();

        var count = 0;
        for (var gpad in tempList) {
            if(tempList[gpad] !== undefined && gpad != "length" && tempList.hasOwnProperty(gpad)){
                count++;

                //attach some details to the gamepad object
                mapPad(tempList[gpad]);

                //push it in our own stack of gamepads
                gamePadList.push({
                    player: count,
                    gamepad: tempList[gpad],
                    gamepadIndex: gpad
                });

                //here we set up the basis for our current object
                if(!CI['gamepad'][gpad]){
                    CI['gamepad'][gpad] = {
                        type: tempList[gpad].gpadType,
                        values: {}
                    };
                }
            }
        }

        return gamePadList;
    };

    /*========= INITIALIZATION ========*/

    inpoot.initialize = function (options) {

        //setup listeners
        document.onkeydown = onKeyDown;
        document.onkeyup = onKeyUp;
        document.onmousemove = onMouseMove;
        document.onmousedown = onMouseDown;
        document.onmouseup = onMouseUp;

        //detect gamepads
        gamepads = getGamePads();

        //get the actions
        actions = options.actions;

        //number of players
        maxPlayers = options.maxPlayers || 1;

        //mouse normalization factor
        mouseNormalizer = options.mouseNormalizer || 3;

        //grab the gamepad type maps from local storage
        gamepadmaps = $.storage.getObject('gamepadmaps') || {};

        //check to see if we have default mapping and if we need to set it
        if(options.mappings && $.storage.getObject('inpoot_action_mappings') === null){
             inpoot.setMappings(options.mappings);
        }

        //check to see if we have default player -> action mappings
        if(options.players && $.storage.getObject('inpoot_stored_players') === null){
             inpoot.setPlayers(options.players);
        }
    };


    //support function to map gamepad raw inputs to stored gamepad type buttons
    var updateGpadTypeMaps = function() {
        gamepadmaps = $.storage.getObject('gamepadmaps') || {};
    };

    var getGPadTypeMapping = function (gpadType, inputType, inputIndex) {
        return gamepadmaps[gpadType].rawToButton[inputType][inputIndex];
    };

    var getGamePadText = function (gpadType, buttonType, key) {
        var gpadConfigs = getGamepadConfigurations(gpadType);
        return gpadConfigs[buttonType][key].name || key;
    };

    var getGamePadInputInfo = function (gpadType, key, value) {
        var refToAxisMap = gamepadmaps[gpadType].rawToButton.axesMap[key],
            text;

        if(!refToAxisMap) {

            text = getGamePadText(gpadType, 'button', key);
            var refToInfo = gamepadmaps[gpadType].rawToButton['buttons'][key];

            return {
                text: text,
                value: key,
                buttonType:'button',
                subType: ''
            };

        } else {

            text = getGamePadText(gpadType, 'axis_dual', refToAxisMap.bid);
            var direction = refToAxisMap.subType == "y" ? (value <= 0 ? "down" : "up") : (value > 0 ? "right" : "left");

            return {
                text: text + ' ' + refToAxisMap.direction,
                value: refToAxisMap.bid,
                buttonType:'axis_dual',
                subType: refToAxisMap.subType,
                direction: refToAxisMap.direction
            };
        }
    };

    //Call this to scan all actions and update state
    var tickInterval = 0;

    //Here is a flag that is used to determine if we need to update the players and mappings used in action mapping (used internally mostly)
    var refreshParamsFlag = false; //this is set to true internally if we need to refresh mappings
    inpoot.refreshParams = function () {
        refreshParamsFlag = true;
    };

    //this is the deadzone radius for gamepad axes (sometimes gamepads by default are worn down and axes can get stuck in an "on" position)
    var threshold = 0.35;
    inpoot.setThreshold = function (newThreshold) {
        threshold = newThreshold;
    };

    //the main area to scan all inputs (note this is really only for gamegpads because mouse and keyboard mapping is done through browser events)
    inpoot.tick = function (permission) {

        //if the UI is open then we want to reserve ticks for the UI
        if(uiOpen && !permission){return;}

        //first check if the mouse has been idle so we can kill old values
        mouseMoved++;
        if(mouseMoved > 1){
            CI['mouse']['mouseDX'] = 0;
            CI['mouse']['mouseDY'] = 0;
        }

        //copy CI into LI
        LI = $.extend(true, {}, CI);

        //to allow for keypressed we need to take a snapshot from the currentKeyboard
        CI.keyboard = $.extend(true, {}, currentKeyboard);

        //we only need to get the gamepads every 10000 ticks or so (in case they turn one on later)
        if(tickInterval === 0) {
            gamepads = getGamePads();
            updateActionLoopInfo();
        }

        //move our interval forward
        tickInterval = (tickInterval + 1) % 1000;

        //if this flag is set force the tickInterval to 0 so we get new references to player and action mappings
        if(refreshParamsFlag){
            tickInterval = 0;
            refreshParamsFlag = false;
        }

        //get the newly updated stuff
        var rawPads = getRawPads();

        //now search all gamepads (right now it is just buttons and axes)
        for(var i=0; i < gamepads.length; i++){

            var thisG = gamepads[i];
            var rawDog = rawPads[thisG.gamepadIndex];

            if (rawDog && rawDog.gpadType) {

                //look at all buttons
                for (var j = 0; j < rawDog.buttons.length; j++) {
                    try {
                        CI['gamepad'][thisG.gamepadIndex].values[getGPadTypeMapping(rawDog.gpadType, 'buttons', j).bid] = rawDog.buttons[j];
                    } catch (e) {}

                }

                //look at all axis
                for (var k = 0; k < rawDog.axes.length; k++) {
                    var thisGMap = getGPadTypeMapping(rawDog.gpadType, 'axes', j);
                    var absValue = Math.abs(rawDog.axes[k]);
                    var threshValue = absValue > threshold ? absValue : 0;
                    if(thisGMap.subType == 'x'){
                        if(rawDog.axes[k] <= 0){
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'left'] = threshValue;
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'right'] = 0;
                        } else {
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'left'] = 0;
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'right'] = threshValue;
                        }
                    } else {
                        if(rawDog.axes[k] <= 0){
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'up'] = threshValue;
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'down'] = 0;
                        } else {
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'up'] = 0;
                            CI['gamepad'][thisG.gamepadIndex].values[thisGMap.bid + 'down'] = threshValue;
                        }
                    }
                }
            }
        }

        //not really needed but great for debugging
        return CI;
    };


    var actionPolls = 0;
    var playerMap = {};
    var actionMaps = {};
    var actionMapIdMap = {};

    //a utility function to update all the global references to players and action maps
    var updateActionLoopInfo = function () {

        //first the player maps
        playerMap = {};
        var allPlayers = $.storage.getObject('inpoot_stored_players');
        for(var playa in allPlayers) {
            var thisPlaya = allPlayers[playa];

            //set up the basics
            playerMap[thisPlaya.number] = {
                actionMapId : thisPlaya.actionMapId,
                gamepad: thisPlaya.gamepad,
                gamepadIndex: thisPlaya.options.gpadIndex,
                invert : thisPlaya.options.axes
            };
        }

        //actionMaps
        actionMaps = $.storage.getObject('inpoot_action_mappings');

        //then a map from actionMapId to the array position
        for(var i=0; i < actionMaps.length; i++){
            actionMapIdMap[actionMaps[i].id] = i;
        }
    };

    //IMPORTANT: This is the main function developers will use to get action values. Was this action pressed? What is the current value? Delta?
    inpoot.action = function (action, pNum, options) {

        options = options || {};

        //pNum is 1 by default if you don't include it
        pNum = pNum || 1;

        //the default values for the return values of this action
        var returnObj = {
            pressed: 0,
            delta: 0,
            val: 0
        };

        var thisPlayer = playerMap[pNum];
        var actionRef, currentVal, oldVal;

        if (thisPlayer && actionMaps[actionMapIdMap[thisPlayer.actionMapId]] && (actionRef = actionMaps[actionMapIdMap[thisPlayer.actionMapId]].mapping[action])) {

            var theseInputs = actionRef.inputs || [];

            for(var j=0; j < theseInputs.length; j++){

                for(var k=0; k < theseInputs[j].inputs.length; k++){

                    if(theseInputs[j].inputs[k].type == "keyboard") {

                        if(CI['keyboard'][theseInputs[j].inputs[k].value] === undefined) {
                            CI['keyboard'][theseInputs[j].inputs[k].value] = 0;
                        }

                        currentVal = CI['keyboard'][theseInputs[j].inputs[k].value];
                        oldVal = LI['keyboard'][theseInputs[j].inputs[k].value];

                        returnObj.val = currentVal;
                        returnObj.pressed = !currentVal && oldVal;
                        returnObj.delta = currentVal - oldVal;

                        if(returnObj.pressed && options.clear){
                            CI['keyboard'][theseInputs[j].inputs[k].value] = 0;
                            LI['keyboard'][theseInputs[j].inputs[k].value] = 0;
                        }

                    } else if (theseInputs[j].inputs[k].type == "gamepad") {

                        if (CI['gamepad'][thisPlayer.gamepadIndex] !== false && CI['gamepad'][thisPlayer.gamepadIndex] !== undefined) {

                            if (theseInputs[j].inputs[k].buttonType == "axis_dual") {

                                //is this action inverted?
                                if(thisPlayer.invert && thisPlayer.invert[theseInputs[j].inputs[k].value] && (theseInputs[j].inputs[k].direction == "up" || theseInputs[j].inputs[k].direction == "down")){

                                    if(theseInputs[j].inputs[k].direction == "up"){
                                        currentVal = CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + "down"];
                                        oldVal = LI['gamepad'][thisPlayer.gamepadIndex] ? LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + "down"] : 0;
                                    } else {
                                        currentVal = CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + "up"];
                                        oldVal = LI['gamepad'][thisPlayer.gamepadIndex] ? LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + "up"] : 0;
                                    }

                                } else {

                                    currentVal = CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + theseInputs[j].inputs[k].direction];
                                    oldVal = LI['gamepad'][thisPlayer.gamepadIndex] ? LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + theseInputs[j].inputs[k].direction] : 0;
                                }

                                returnObj.val = currentVal;
                                returnObj.pressed = !currentVal && oldVal;
                                returnObj.delta = currentVal - oldVal;

                                if(returnObj.pressed && options.clear){
                                    CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + theseInputs[j].inputs[k].direction] = 0;
                                    LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value + theseInputs[j].inputs[k].direction] = 0;
                                }

                            } else {

                                currentVal = CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value];
                                oldVal = LI['gamepad'][thisPlayer.gamepadIndex] ? LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value] : 0;

                                returnObj.val = currentVal;
                                returnObj.pressed = !currentVal && oldVal;
                                returnObj.delta = currentVal - oldVal;

                                if(returnObj.pressed && options.clear){
                                    CI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value] = 0;
                                    LI['gamepad'][thisPlayer.gamepadIndex].values[theseInputs[j].inputs[k].value] = 0;
                                }
                            }
                        }

                    } else if (theseInputs[j].inputs[k].type == "mouse") {

                        if(theseInputs[j].inputs[k].value == "mouse_up"){

                            currentVal = CI['mouse']['mouseDY'] < 0 ? Math.min(Math.abs(CI['mouse']['mouseDY']) / mouseNormalizer,1) : 0;
                            oldVal = LI['mouse']['mouseDY'] < 0 ? Math.min(Math.abs(CI['mouse']['mouseDY']) / mouseNormalizer,1) : 0;

                        } else if (theseInputs[j].inputs[k].value == "mouse_down") {

                            currentVal = CI['mouse']['mouseDY'] >= 0 ? Math.min(CI['mouse']['mouseDY'] / mouseNormalizer,1) : 0;
                            oldVal = LI['mouse']['mouseDY'] >= 0 ? Math.min(CI['mouse']['mouseDY'] / mouseNormalizer,1) : 0;

                        } else if (theseInputs[j].inputs[k].value == "mouse_left") {

                            currentVal = CI['mouse']['mouseDX'] < 0 ? Math.min(Math.abs(CI['mouse']['mouseDX']) / mouseNormalizer,1) : 0;
                            oldVal = LI['mouse']['mouseDX'] < 0 ? Math.min(Math.abs(CI['mouse']['mouseDX']) / mouseNormalizer,1) : 0;

                        } else if (theseInputs[j].inputs[k].value == "mouse_right") {

                            currentVal = CI['mouse']['mouseDX'] >= 0 ? Math.min(CI['mouse']['mouseDX'] / mouseNormalizer,1) : 0;
                            oldVal = LI['mouse']['mouseDX'] >= 0 ? Math.min(CI['mouse']['mouseDX'] / mouseNormalizer,1) : 0;

                        } else {

                            currentVal = CI['mouse'][theseInputs[j].inputs[k].value];
                            oldVal = LI['mouse'][theseInputs[j].inputs[k].value];
                        }

                        returnObj.val = currentVal;
                        returnObj.pressed = !currentVal && oldVal;
                        returnObj.delta = currentVal - oldVal;
                    }
                }
            }
        }

        //make sure that the val is 0 at minimum
        if(!returnObj.val){
            returnObj.val = 0;
        }
        if(!returnObj.pressed){
            returnObj.pressed = 0;
        }
        if(!returnObj.delta){
            returnObj.delta = 0;
        }

        return returnObj;
    };



    //========================================================================================================
    //                   OTHER PUBLIC API METHODS
    //========================================================================================================

    /*========= RESET THE DEFAULT PLAYER AND MAPPING CONFIGURSTIONS ========*/

    //If they were passed in we will overwrite any modifications to use the defaults passed in during initialization
    inpoot.resetConfigs = function () {

        if(defaultPlayers){
            inpoot.setPlayers(defaultPlayers);
        }

        if(defaultMappings){
            inpoot.setMappings(defaultMappings);
        }
    };

    /*========= GET AND SET MAPPINGS (great for protecting your mappings and hardcoding them) ========*/

    //This method is useful for copying your mappings as a developer so you can hard code them when you are done setting up initial mappings
    inpoot.getMappings = function () {

        var allMappings = $.storage.getObject('inpoot_action_mappings');
        return JSON.stringify(allMappings);
    };

    //If you have hardcoded the mappings for your users then call this or pass it in during initialization as "mappings"
    inpoot.setMappings = function (mappingInfo) {

        if(typeof(mappingInfo) == 'string'){
            mappingInfo = JSON.parse(mappingInfo);
        }

        defaultMappings = mappingInfo;

        $.storage.setObject('inpoot_action_mappings', mappingInfo);
    };

    /*========= GET AND SET PLAYER CONFIGS (great for protecting your player options so you can hard code them) ========*/

    //This method is useful for copying your player mappings/options as a developer so you can hard code them when you are done setting up player mappings
    inpoot.getPlayers = function () {

        var splayers = $.storage.getObject('inpoot_stored_players');
        return JSON.stringify(splayers);
    };

    //If you have hardcoded the player configs for your users then call this or pass it in during initialization as "players"
    inpoot.setPlayers = function (playerInfo) {

        if(typeof(playerInfo) == 'string'){
            playerInfo = JSON.parse(playerInfo);
        }

        defaultPlayers = playerInfo;

        $.storage.setObject('inpoot_stored_players', playerInfo);
    };


    /*========= WEB SERVICE BASED API (Ways to get gamepad configurations from a remote repository) ========*/

    //call this if you want the plugin to go search online for gamepad configurations for this browser/os combination
    inpoot.getRemoteGamepadConfigs = function() {};




    //========================================================================================================
    //             BELOW IS CODE FOR THE UI FOR MANAGING ACTION MAPPING AND PLAYER ASSIGNMENTS
    //========================================================================================================


    /*========= GAME PAD MAPPINGS (GAMEPAD BUTTONS => REPORTED BUTTON/AXES NUMBERS) ========*/

    //generates a new mapping
    var generateBlankGpadMap = function (gpadType) {

        var padConfigs = inpoot.gamepads[gpadType];

        var blankMap = {
            'buttonToRaw':{button:{}, axis:{}, axis_dual:{}},
            'rawToButton' : {buttons:{}, axes:{}, axesMap:{}}
        };

        if(!padConfigs){
            alert('We do not have configurations stored for this type of gamepad:' + gpadType);
            return;
        }

        for(var button in padConfigs.button){
            blankMap['buttonToRaw']['button'][button] = false;
        }

        for(var axis in padConfigs.axis_dual){
            blankMap['buttonToRaw']['axis_dual'][axis] = {x:false, y:false};
        }

        return blankMap;
    };

    //note gamepadmaps was populated from local storage during initialization()
    var getGamepadMapping = function (gpadType) {

        var gpadMap = gamepadmaps[gpadType];

        if (!gpadMap) {

            gpadMap = generateBlankGpadMap(gpadType);

            if (!gpadMap) {
                return false;
            } else {

                gamepadmaps[gpadType] = gpadMap;
                $.storage.setObject('gamepadmaps', gamepadmaps);

                return gpadMap;
            }

        } else {
            return gpadMap;
        }
    };

    //get just the stored button configuration for the gamepad
    var getGamepadConfigurations = function (gpadType) {
        return inpoot.gamepads[gpadType];
    };

    //quick function to save a copy of the current gamepadmaps into local storage
    var saveGamepadMapping = function () {
        $.storage.setObject('gamepadmaps', gamepadmaps);
    };


    /*========= MAIN MENU ========*/

    var launch_main = function () {

        //behavior for this view
        var mainPP = function (item) {

            var uiNode = $(item.nodes[0]);

            uiNode.find('.inpoot-main-option.players').click(function(){
                launch_players();
            });
            uiNode.find('.inpoot-main-option.settings').click(function(){
                launch_calibrate();
            });
            uiNode.find('.inpoot-main-option.mappings').click(function(){
                launch_mappings();
            });
        };

        //render the content and add behavior
        inpoot.utils.modal.show({template:'inpoot.main-content', data:{}, behavior: mainPP});
    };


    /*========= ACTION MAPPINGS menu ========*/

    //get gamepadMapping uuid
    var getNewActionMapId = function () {

        var allActionMappings = getAllActionMappings();

        var highest = -1;
        for(var i=0; i < allActionMappings.length; i++){

            if(highest < allActionMappings[i].id) {
                highest = allActionMappings[i].id;
            }
        }

        return highest + 1;
    };

    var getAllActionMappings = function (actionMapId) {

        var allActionMappings = $.storage.getObject('inpoot_action_mappings');
        if(!allActionMappings){
            allActionMappings = [];
            $.storage.setObject('inpoot_action_mappings', allActionMappings);
        }

        if(actionMapId === undefined || actionMapId === null){

            return allActionMappings;

        } else {

            for(var i=0; i < allActionMappings.length; i++){

                if(allActionMappings[i].id == actionMapId) {
                    return allActionMappings[i];
                }
            }
        }
    };

    var deleteActionMap = function (actionMapId) {

        var allActionMappings = getAllActionMappings();

        for(var i=0; i < allActionMappings.length; i++){

            if(allActionMappings[i].id == actionMapId) {
                allActionMappings.splice(i,1);
                $.storage.setObject('inpoot_action_mappings', allActionMappings);
            }
        }
    };

    var getNewActionMap = function () {

        //make a copy of the actions TODO: use a copy of default mapping...
        var newActionMap = $.extend({},actions);
        return newActionMap;
    };

    //this view allows a user to edit a set of action mappings
    var launch_edit_action_map = function (actionMapId) {

        //let's make sure we update the mappings
        updateGpadTypeMaps();

        //first get all the mappings
        var thisActionMap = getAllActionMappings(actionMapId);
        var storedGamepads = $.storage.getObject('storedGamepads') || [];

        //save changes to this map
        var saveActionMap = function () {

            var allActionMappings = getAllActionMappings();

            for(var i=0; i < allActionMappings.length; i++) {
                if(allActionMappings[i].id == actionMapId){
                    allActionMappings[i] = thisActionMap;
                    $.storage.setObject('inpoot_action_mappings', allActionMappings);
                }
            }
        };

        //the behavior for this view
        var actionMapPP = function (item) {

            var uiNode = $(item.nodes[0]);
            var thisActionMap = item.data.actionMap;

            //when they click back in this view send them back to the main menu
            uiNode.find('.inpoot-top-option').click(launch_mappings);

            //add this sweet @$$ new editing behavior to this item
            uiNode.find('.inpoot-main-gamepad-options-message input').inpootEdit({
                onChange: function(newValue){
                    thisActionMap.name = newValue;
                    saveActionMap();
                },
                defaultText : 'New Mapping'
            });

            //setup the gamepad options
            var gamepadOptions = [{text: 'OFF', value: 'false', style: 'off', message:'Warning, this will remove all mappings that currently use the gamepad'}];

            for(var i=0; i < storedGamepads.length; i++){
                gamepadOptions.push({
                    text: storedGamepads[i].displayName,
                    value: storedGamepads[i].gpadType,
                    style: 'on',
                    message: 'Switching gamepads will remove all mappings from other gamepads',
                    ifNot:['false']
                });
            }

            //setup the styled select containers
            inpoot.utils.styledSelect({
                container: $('.inpoot-input-selector.keyboard'),
                selected: thisActionMap.keyboard,
                options: [
                    {text: 'ON', value: 'true', style: 'on'},
                    {text: 'OFF', value: 'false', style: 'off', message:'Warning, this will remove all mappings that currently use the keyboard'}
                ],
                callBack: function (newSelected) {thisActionMap.keyboard = newSelected.value; saveActionMap();}
            });

            inpoot.utils.styledSelect({
                container: $('.inpoot-input-selector.mouse'),
                selected: thisActionMap.mouse,
                options : [
                    {text: 'ON', value: 'true', style: 'on'},
                    {text: 'OFF', value: 'false', style: 'off', message:'Warning, this will remove all mappings that currently use the mouse'}
                ],
                callBack: function (newSelected) {thisActionMap.mouse = newSelected.value; saveActionMap();}
            });

            inpoot.utils.styledSelect({
                container: $('.inpoot-input-selector.gamepad'),
                selected: thisActionMap.gamepad,
                options: gamepadOptions,
                callBack: function (newSelected) {thisActionMap.gamepad = newSelected.value; saveActionMap();}
            });

            //==== NOW WE SETUP THE EDITING FOR THE MAPPINGS ====

            //get a new input combination Id
            var getNewInputCombinationId = function (inputs) {

                var highest = -1;
                for(var i=0; i < inputs.length; i++){

                    if(highest < inputs[i].id) {
                        highest = inputs[i].id;
                    }
                }

                return highest + 1;
            };

            //delete an input combination by actionId and mapId
            var deleteInputCombination = function (actionId, mapId, callBack) {

                var allInputs = thisActionMap.mapping[actionId].inputs;

                var foundIndex = -1;
                for(var i=0; i < allInputs.length; i++){

                    if(allInputs[i].id == mapId){
                        foundIndex = i;
                        break;
                    }
                }

                if(foundIndex != -1){

                    //slice and save
                    allInputs.splice(foundIndex,1);
                    saveActionMap();
                    callBack();
                }
            };

            //get a specified input combination
            var getInputCombination = function (allInputs, mapId) {

                for(var i=0; i < allInputs.length; i++){
                    if(allInputs[i].id == mapId){
                        return allInputs[i];
                    }
                }
            };

            //behavior for the mappings listed for an action
            var drawMapPP = function (item) {

                var drawNode = $(item.nodes[0]);
            };

            //a draw method to refresh the right side with current list of mappings
            var drawMappings = function (actionId) {

                $.tmpl('inpoot.action_map.action_list_mappings',thisActionMap, {rendered:drawMapPP}).appendTo($('.inpoot-map-form-right-inner').html(''));
            };

            //the logic to support live mapping
            var startLiveMapping = function (item) {

                var liveNode = $(item.nodes[0]);
                var liveNodeData = item.data;

                var gamepadArea = liveNode.find('.inpoot-edit-mapping-gather-inputs.gamepad');
                var gamepadList = gamepadArea.find('.inpoot-edit-mapping-gather-input-list');

                var keyboardArea = liveNode.find('.inpoot-edit-mapping-gather-inputs.keyboard');
                var keyboardList = keyboardArea.find('.inpoot-edit-mapping-gather-input-list');

                var mouseArea = liveNode.find('.inpoot-edit-mapping-gather-inputs.mouse');
                var mouseList = mouseArea.find('.inpoot-edit-mapping-gather-input-list');

                var actionMap = liveNodeData.actionMap;
                var actionId = liveNodeData.actionId;

                //first let's indicate visually that we are editing
                $('.inpoot-map-form').addClass('editing');

                //wire up the close edit button
                $('.inpoot-editing-inputs-close').unbind('click').click(function(){

                    //then remove editing class
                    $('.inpoot-map-form').removeClass('editing');

                    //and redraw the originals
                    editAction(liveNodeData.actionId);
                });

                //when x'ed out, then we delete it.
                var deleteInput = function (type, inputInfo) {

                    var allInputs = thisActionMap.mapping[actionId].inputs;
                    var thisMapId = liveNodeData.mapId;

                    var foundIndex = -1;
                    for(var i=0; i < allInputs.length; i++){

                        if(allInputs[i].id == thisMapId){
                            foundIndex = i;
                            break;
                        }
                    }

                    if(foundIndex != -1){

                        var thisInputCombination = allInputs[foundIndex];

                        for(var j=0; j < thisInputCombination.inputs.length; j++){
                            if(thisInputCombination.inputs[j].type == type && thisInputCombination.inputs[j].value == inputInfo.value){
                                thisInputCombination.inputs.splice(j,1);
                                saveActionMap();
                            }
                        }
                    }
                };

                //display input
                var displayInput = function (type, inputInfo) {
                    var targetContainer = type == 'gamepad' ? gamepadList : (type == 'mouse' ? mouseList : keyboardList);

                    var inputPP = function (item) {

                        var inputNode = $(item.nodes[0]);

                        //wire up the removal
                        inputNode.find('.inpoot-x-out').click(function() {
                            deleteInput(type, inputInfo);
                            inputNode.fadeOut(function(){
                                inputNode.remove();
                            });
                        });
                    };

                    $.tmpl('inpoot.action_map.action_edit_action_map_item', {name: inputInfo.text}, {rendered: inputPP}).appendTo(targetContainer);
                };

                //this function will add an input to the proper space
                var addInput = function (type, inputInfo, val) {

                    console.log('adding', type, inputInfo, val);

                    var thisInputId = actionMap.id;
                    var inputIndex = liveNodeData.mapId;

                    var thisInputCombo = getInputCombination(actionMap.mapping[actionId].inputs, inputIndex);

                    //add it in and save it
                    thisInputCombo.inputs.push({
                        type: type,
                        text: inputInfo.text,
                        value: inputInfo.value,
                        buttonType: inputInfo.buttonType,
                        subType: inputInfo.subType,
                        direction: inputInfo.direction
                    });

                    console.log('adding:', inputInfo.direction, inputInfo);

                    saveActionMap();
                    displayInput(type, inputInfo);
                };

                //holds which inputs are currently active
                var inputsDown = {
                    'keyboard' : {},
                    'gamepad' : {}
                };

                var oldInputsDown = {};

                var gpadType = liveNodeData.actionMap.gamepad;

                //and the logic to analyze the current CI to add inputs
                var lookForLiveMapping = function () {

                    //now look for new gamepad inputs (but only those that match this mappings gamepad type)
                    for(var gpad in CI['gamepad']) {
                        var thisPad = CI['gamepad'][gpad];
                        if(thisPad.type == gpadType){
                            for(var padKey in thisPad.values){
                                if (thisPad.values[padKey]) {
                                    inputsDown['gamepad'][padKey] = thisPad.values[padKey];
                                } else {
                                    inputsDown['gamepad'][padKey] = 0;
                                }
                            }
                        }
                    }

                    //check for gamepad inputs that match the current type (we use 0.5 here because xbox triggers default out at 0.5)
                    for(var key in inputsDown['gamepad']){
                        if(Math.abs(inputsDown['gamepad'][key]) <= 0.5 && oldInputsDown['gamepad'] && Math.abs(oldInputsDown['gamepad'][key]) > 0.5){
                            addInput('gamepad', getGamePadInputInfo(gpadType, key, oldInputsDown['gamepad'][key]));
                        }
                    }

                    //now store the copy of the old one for tracking gamepad changes
                    oldInputsDown = $.extend(true, {}, inputsDown);

                    //lastly we look for keyboard inputs
                    if(actionMap.keyboard && actionMap.keyboard != "false"){

                        //Look for release of keyboard inputs first
                        for(key in inputsDown['keyboard']){

                            if(inputsDown['keyboard'][key] === true && !CI['keyboard'][key]){
                                addInput('keyboard', {text: inpoot.getKeyboardMap(key), value:key});
                                delete inputsDown['keyboard'][key];
                            }
                        }

                        //now look for new keyboard inputs
                        for(key in CI['keyboard']){
                            if (CI['keyboard'][key]) {
                                inputsDown['keyboard'][key] = true;
                            }
                        }
                    }
                };

                //put all current inputs into the mix
                var thisListInputObject = getInputCombination(actionMap.mapping[actionId].inputs, liveNodeData.mapId);
                var thisInputList = thisListInputObject.inputs;
                for(var i = 0; i < thisInputList.length; i++){
                    displayInput(thisInputList[i].type, thisInputList[i]);
                }

                //if we have a mouse wire up the mouse input button
                if(actionMap.mouse && actionMap.mouse != "false"){

                    var gContainer = $('.dumbBox-content');

                    mouseArea.find('.inpoot-gather-add-button').click(function() {
                        var gpadOptions = [
                            {text:'mouse up', value:'mouse_up'},
                            {text:'mouse down', value:'mouse_down'},
                            {text:'mouse left', value:'mouse_left'},
                            {text:'mouse right', value:'mouse_right'},
                            {text:'left button', value:'mouse_button_left'},
                            {text:'middle button', value:'mouse_button_middle'},
                            {text:'right button', value:'mouse_button_right'},
                            {text:'back button', value:'mouse_button_back'},
                            {text:'forward button', value:'mouse_button_forward'},
                            {text:'scroll forward', value:'mouse_scroll_forward'},
                            {text:'scroll back', value:'mouse_scroll_back'}
                        ];

                        var selectBox = inpoot.utils.optionBox({
                            title: undefined,
                            container: gContainer,
                            options: gpadOptions,
                            maxHeight:400,
                            callBack: function(chosenOpt){
                                addInput('mouse', chosenOpt);
                            }
                        });
                    });
                }

                //if we have a gamepad wire up the gamepad input button
                if(actionMap.gamepad && actionMap.gamepad != "false"){

                    var mapGamepad = getGamepadConfigurations(actionMap.gamepad);

                    var gPadOptions = [];
                    var addOption = function (text, value, data) {
                        gPadOptions.push({text:text, value:value, data:data});
                    };

                    var getOptionText = function (button, buttonContainer) {
                        return buttonContainer[button].name ? buttonContainer[button].name : button;
                    };

                    for(var button in mapGamepad.button){
                        addOption(getOptionText(button, mapGamepad.button), button, {subType:'button'});
                    }

                    for(var axis in mapGamepad.axis_dual){
                        addOption(getOptionText(axis, mapGamepad.axis_dual) + ' up', axis, {buttonType:'axis_dual', subType:'y', direction:'up'});
                        addOption(getOptionText(axis, mapGamepad.axis_dual) + ' down', axis, {buttonType:'axis_dual', subType:'y', direction: 'down'});
                        addOption(getOptionText(axis, mapGamepad.axis_dual) + ' left', axis, {buttonType:'axis_dual', subType:'x', direction: 'left'});
                        addOption(getOptionText(axis, mapGamepad.axis_dual) + ' right', axis, {buttonType:'axis_dual', subType:'x', direction: 'right'});
                    }

                    var gContainer1 = $('.dumbBox-content');

                    gamepadArea.find('.inpoot-gather-add-button').click(function() {

                        var selectBox = inpoot.utils.optionBox({
                            title: undefined,
                            container: gContainer1,
                            options: gPadOptions,
                            maxHeight:400,
                            callBack: function(chosenOpt){
                                addInput('gamepad', {
                                    value: chosenOpt.value,
                                    text: chosenOpt.text,
                                    subType: chosenOpt.data.subType,
                                    buttonType: chosenOpt.data.buttonType,
                                    direction: chosenOpt.data.direction
                                });
                            }
                        });
                    });
                }

                //now we can start the loop to test inputs so users can add keys by gamepad and keyboard
                inpoot.utils.poll.setInterval(
                    function(){
                        inpoot.tick(true);
                        lookForLiveMapping();
                    },
                100,'live-mapping');
            };

            //a draw method to show the LIVE MAPPING
            var drawLiveMapping = function (actionId, mapId) {

                var thisInputList = thisActionMap.mapping[actionId].inputs;
                var thisInput = getInputCombination(thisInputList, mapId);
                var hiddenColumn = $('.inpoot-map-form-left-hidden-inner');

                var displayText = thisActionMap.mapping[actionId].descr ? thisActionMap.mapping[actionId].descr : actionId;

                //populate the text in the hidden columns and show the hidden column
                hiddenColumn.find('.inpoot-editing-inputs-title').html(displayText);

                //determine how many inputs we have
                var inputCount = 0;
                if(thisActionMap.keyboard && thisActionMap.keyboard != "false"){
                    inputCount++;
                }
                if(thisActionMap.mouse && thisActionMap.mouse != "false"){
                    inputCount++;
                }
                if(thisActionMap.gamepad && thisActionMap.gamepad != "false"){
                    inputCount++;
                }

                //then populate the editing area with the buttons
                $.tmpl('inpoot.action_map.action_edit_mapping', {actionMap:thisActionMap, actionId:actionId, mapId:mapId, inputCount: inputCount}, {rendered:startLiveMapping}).appendTo($('.inpoot-map-form-right-inner').html(''));
            };

            //======logic for handling group switches

            var currentGroup;

            var editAction = function (actionId) {

                //we might have been coming from an inner view so clear the monitoring for keystrokes
                inpoot.utils.poll.clear('live-mapping');

                //get the action
                var thisAction = thisActionMap.mapping[actionId];

                //the behavior for editing
                var editActionPP = function (item) {

                    var editNode = $(item.nodes[0]);
                    var editData = item.data;

                    //add a new input combination
                    var addNewInputCombination = function () {

                        thisActionMap.mapping[actionId].inputs = thisActionMap.mapping[actionId].inputs || [];

                        var thisInputList = thisActionMap.mapping[actionId].inputs;

                        var mapId = getNewInputCombinationId(thisInputList);
                        thisInputList.push({id: mapId, inputs:[]});
                        saveActionMap();

                        $.tmpl('inpoot.action_map.action_edit_action_input_hidden', [{id: mapId, inputs:[]}], {rendered: editActionMapping}).appendTo(editNode.find('.inpoot-main-gamepad-edit-action-options-list'));
                    };

                    //behavior for each of the input combinations that are shown
                    var editActionMapping = function (item) {

                        var editActionMapNode = $(item.nodes[0]);
                        var editActionMapData = item.data;

                        //when clicked we need to edit and map new key inputs
                        editActionMapNode.click(function(){
                            drawLiveMapping(actionId, editActionMapData.id);
                        });

                        //when delete is clicked we need to kill it
                        editActionMapNode.find('.inpoot-x-out').click(function(e){
                            e.preventDefault();
                            e.stopPropagation();

                            deleteInputCombination(actionId, editActionMapData.id, function(){
                                editActionMapNode.fadeOut('fast',function(){
                                    editActionMapNode.remove();
                                });
                            });
                        });

                        //fade us in
                        editActionMapNode.fadeIn('fast');
                    };

                    editNode.find('.inpoot-main-gamepad-edit-action-options').click(addNewInputCombination);

                    //render each of the input combinations for this actionId
                    $.tmpl('inpoot.action_map.action_edit_action_input', editData.inputs || [], {rendered: editActionMapping}).appendTo(editNode.find('.inpoot-main-gamepad-edit-action-options-list').html(''));
                };

                var templateData = {actionId:actionId, descr:thisAction.descr, inputs:thisAction.inputs};

                //render the area for editing
                $.tmpl('inpoot.action_map.action_edit_action_inputs', templateData, {rendered:editActionPP}).appendTo($('.inpoot-map-form-right-inner').html(''));

            };

            var switchToGroup = function (groupName, groupActions) {

                currentGroup = groupName;

                var actionPP = function (item) {
                    var actionNode = $(item.nodes[0]);
                    var actionData = item.data;
                    actionNode.click(function(){
                        $('.inpoot-edit-action-map-list-group-action').removeClass('selected');
                        actionNode.addClass('selected');
                        editAction(actionData.actionId);
                    });
                };

                $.tmpl('inpoot.action_map.action_list_item',groupActions,{rendered:actionPP}).appendTo($('.inpoot-map-form-middle-inner').html(''));

                //then select the first action
                if($('.inpoot-edit-action-map-list-group-action').length > 0){
                    $($('.inpoot-edit-action-map-list-group-action')[0]).click();
                }
            };

            //behavior for the left column containing the list of actions
            var mapPP = function (item) {

                var mapNode = $(item.nodes[0]);
                var mapData = item.data;

                mapNode.click(function(){
                    $('.inpoot-edit-action-map-list-group').removeClass('selected');
                    mapNode.addClass('selected');
                    switchToGroup(mapData.name, mapData.actions);
                });
            };

            //======logic for handling group rendering and behavior

            //format the mapping data so that we can render the groups of actions
            var getGroupedActions = function (mapping) {

                var groupingInfo = {};
                var grouped = [];

                var addActionToGroup = function (groupName, actionId, actionInfo) {

                    grouped[groupingInfo[groupName]].actions.push({
                        actionId: actionId,
                        category: groupName,
                        descr: actionInfo.descr || actionId,
                        inputs: actionInfo.inputs
                    });
                };

                for(var map in mapping) {
                    var thisMap = mapping[map];

                    if(thisMap.category){

                        if(groupingInfo[thisMap.category] === undefined) {

                            //we need to push another group in
                            groupingInfo[thisMap.category] = grouped.length;
                            grouped.push({actions:[], name: thisMap.category});
                         }

                        //add it into the proper group
                        addActionToGroup(thisMap.category, map, thisMap);

                    } else {

                        if(groupingInfo['other'] === undefined) {

                            //we need to push another group in
                            groupingInfo['other'] = grouped.length;
                            grouped.push({actions:[], name:'other'});
                        }

                        //add it into the proper group
                        addActionToGroup('other', map, thisMap);
                    }
                }

                return grouped;
            };

            //render the left column
            $.tmpl('inpoot.action_map.action_list', getGroupedActions(thisActionMap.mapping), {rendered:mapPP}).appendTo($('.inpoot-map-form-left-inner'));

            //then select the first one
            if($('.inpoot-edit-action-map-list-group').length > 0){
                $($('.inpoot-edit-action-map-list-group')[0]).click();
            }
        };

        //right away let's save away the "click to edit"
        if(thisActionMap.extra == "click to edit") {
            thisActionMap.extra = "";
            saveActionMap();
        }

        //render the main UI
        inpoot.utils.modal.show({template: 'inpoot.action_map', data: {actionMap:thisActionMap, gamepads:storedGamepads}, behavior: actionMapPP});
    };


    //this view shows all saved action maps
    var launch_mappings = function(){

        //create a new mapping
        var newMapping = function () {

            var allActionMappings = getAllActionMappings();
            var newActionMapping = {
                name: 'New Mapping',
                extra:'click to edit',
                gamepad: false,
                keyboard: true,
                mouse: true,
                id: getNewActionMapId(),
                mapping: getNewActionMap()
            };

            //pop in the new one and save
            allActionMappings.push(newActionMapping);
            $.storage.setObject('inpoot_action_mappings', allActionMappings);
        };

        //render the Mapping List
        var renderMappingList = function () {

            //the container
            var listContainer = $('.inpoot-mappings-list');

            //behavior for this list item
            var mapListPP = function(item){

                var node = $(item.nodes[0]);

                //start delete workflow
                node.find('.inpoot-mapping-item-delete').click(function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    node.find('.inpoot-mapping-item-inputs').stop(true,true).hide();
                    node.find('.inpoot-mapping-item-delete-confirm').stop(true,true).fadeIn('fast');
                });

                //cancel the delete
                node.find('.inpoot-mapping-item-delete-confirm-cancel').click(function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    node.find('.inpoot-mapping-item-delete-confirm').stop(true,true).hide();
                    node.find('.inpoot-mapping-item-inputs').stop(true,true).fadeIn('fast');
                });

                //confirm the delete
                node.find('.inpoot-mapping-item-delete-confirm-okay').click(function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    node.slideUp(function(){
                        node.remove();
                        deleteActionMap(item.data.id);
                        inpoot.utils.modal.expand();
                    });
                });

                //click to edit (the others have stopped propagation so we are good)
                node.click(function(){
                    launch_edit_action_map(item.data.id);
                });
            };

            //get the mappings
            var allActionMappings = getAllActionMappings();

            //clear the container and render the data
            listContainer.html('');
            $.tmpl('inpoot.mapping-list', allActionMappings, {rendered:mapListPP}).appendTo(listContainer);

            //then resize
            inpoot.utils.modal.expand();
        };

        //main behavior for this UI
        var mappingPP = function (item) {

            var uiNode = $(item.nodes[0]);

            //when they click back in this view send them back to the main menu
            uiNode.find('.inpoot-top-option').click(launch_main);

            //wire up the addition of the a new mapping
            uiNode.find('.inpoot-message-button').click(function(){
                newMapping();
                renderMappingList();
            });

            //now render the list
            renderMappingList();
        };

        //render the main UI
        inpoot.utils.modal.show({template: 'inpoot.mappings', data: {}, behavior: mappingPP});
    };


    /*========= calibrate GAMEPADS MENU ========*/

    var launch_calibrate_gpad = function (gpad) {

        var mainNode;

        //method to map an array of buttons
        var buttonList;
        var bindex;
        var mapButtons = function (bList) {
            buttonList = bList;
            bindex = 0;

            //turn off the general watching and clear off pressed buttons
            inpoot.utils.poll.clear('monitor-callibration');
            $('.pressed-now').remove('pressed-now');

            mapNextButton();
        };

        //stop mapping
        var stopMapping = function () {
            inpoot.utils.poll.clear('please-stop');
            inpoot.utils.poll.clear('single-button-press');
            inpoot.utils.poll.clear('continue-monitoring');
            $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').stop(true,true).hide();
            $('.gamepad-button').removeClass('mapped').removeClass('mapping').removeClass('up').removeClass('down').removeClass('right').removeClass('left');
            buttonPressed = false;
            buttonList = [];
            bindex=0;
        };

        //map a single button
        var mapNextButton = function () {

            if(bindex < buttonList.length){

                var thisButton = buttonList[bindex];
                var padConfigs = inpoot.gamepads[gpad.gpadType];

                var thisButtonInfo = padConfigs[thisButton.type][thisButton.bid];
                var buttonName = thisButtonInfo.name || thisButton.bid;
                var additionalText = thisButton.text || "";
                var additionalStyle = thisButton.style || " ";

                $('.gamepadclass-' + thisButton.bid).addClass('mapping' + ' ' + additionalStyle);
                $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').removeClass('thanks').find('.inpoot-gamepad-calibrate-gamepad-3d-presskey-text').html("PRESS <span class='inpoot-gamepad-presskey-bold'> "+ buttonName + " " + additionalText + " </span>");
                $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').stop(true,true).show();

                getButtonPress(function(button){

                    var thisGMap = getGamepadMapping(gpad.gpadType);

                    //add it to the buttonToRaw mapping
                    if(thisButton.type == 'button'){
                        thisGMap.buttonToRaw[button.type][thisButton.bid] = button.number;
                    } else if (thisButton.type == 'axis_dual') {

                        if(thisButton.style == "up" || thisButton.style == "down"){
                            thisGMap.buttonToRaw['axis_dual'][thisButton.bid].y = button.number;
                            thisGMap['rawToButton']['axesMap'][thisButton.bid + 'down'] = {bid:thisButton.bid, index:button.number, subType:'y', direction:'down'};
                            thisGMap['rawToButton']['axesMap'][thisButton.bid + 'up'] = {bid:thisButton.bid, index:button.number, subType:'y', direction:'up'};
                        } else {
                            thisGMap.buttonToRaw['axis_dual'][thisButton.bid].x = button.number;
                            thisGMap['rawToButton']['axesMap'][thisButton.bid + 'left'] = {bid:thisButton.bid, index:button.number, subType:'x', direction:'left'};
                            thisGMap['rawToButton']['axesMap'][thisButton.bid + 'right'] = {bid:thisButton.bid, index:button.number, subType:'x', direction:'right'};
                        }
                    }

                    //and also add it to the rawToButton mapping
                    var subType = false;
                    var rawType = button.type == "button" ? "buttons" : "axes";
                    if(thisButton.style == "up" || thisButton.style == "down") {
                        subType = 'y';
                    } else if (thisButton.style == "left" || thisButton.style == "right") {
                        subType = 'x';
                    }

                    thisGMap['rawToButton'][rawType][button.number] = {type:thisButton.type, bid: thisButton.bid, subType: subType};

                    //save changes
                    saveGamepadMapping();

                    //visually show it was pressed
                    $('.gamepadclass-' + thisButton.bid).addClass('mapped');
                    $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').addClass('thanks');
                    $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').stop(true,true).fadeOut(500, function(){

                        $('.gamepadclass-' + thisButton.bid).removeClass('mapped').removeClass('mapping').removeClass(additionalStyle);
                        bindex++;

                        //gotta have some time for the gamepad input to reset
                        inpoot.utils.poll.setTimeout(function(){
                            buttonPressed = false;
                            mapNextButton();
                        },300,'please-stop');
                    });
                });

            } else {

                //can turn on the regular button listener
                $('.inpoot-gamepad-calibrate-gamepad-3d-presskey').removeClass('thanks').stop(true,true).hide();
                monitorCallibration();
            }
        };

        //listen and report back for the next button
        var buttonPressed = false;
        var getButtonPress = function (callBack) {

            var gamepads = getGamePads();
            var gamepadsToCheck = [];
            for(var i=0; i < gamepads.length; i++){
                if (gamepads[i].gamepad.gpadType == gpad.gpadType) {
                    gamepadsToCheck.push(gamepads[i]);
                }
            }

            //start our hokey version of key monitoring
            inpoot.utils.poll.setInterval(
                function(){

                    var rawPads = getRawPads();

                    //now search all gamepads of this type and look for buttons that were pressed, axis that are pushed
                    for(var i=0; i < gamepadsToCheck.length; i++){

                        var thisG = gamepadsToCheck[i];
                        var rawDog = rawPads[thisG.gamepadIndex];

                        if (rawDog) {

                            //look at all buttons
                            for (var j = 0; j < rawDog.buttons.length; j++) {

                                //using 0.5 for threshold. Noticed trigger button on xbox controller when first plugged in reports 0.5 until pressed
                                if (rawDog.buttons[j] > 0.5 && !buttonPressed) {
                                    buttonPressed = true;
                                    inpoot.utils.poll.clear('single-button-press');
                                    callBack({
                                        type: 'button',
                                        number: j,
                                        value: rawDog.buttons[j]
                                    });
                                }
                            }

                            //look at all axis
                            for (var l = 0; l < rawDog.axes.length; l++) {
                                if (Math.abs(rawDog.axes[l]) > 0.7 && !buttonPressed) {
                                    buttonPressed = true;
                                    inpoot.utils.poll.clear('single-button-press');
                                    callBack({
                                        type: 'axis',
                                        number: j,
                                        value: rawDog.axes[l]
                                    });
                                }
                            }
                        }
                    }
                },
            50, 'single-button-press');
        };

        //get keypresses
        var monitorCallibration = function () {

             var gpadMap = getGamepadMapping(gpad.gpadType);
             var padConfigs = inpoot.gamepads[gpad.gpadType];

             if(!gpadMap){
                return;
             }

             var getNextButton = function () {

                 inpoot.utils.poll.setTimeout(function(){
                    buttonPressed = false;
                    monitor();
                 }, 100, 'continue-monitoring');
             };

             var monitor = function() {
                 getButtonPress(function(button){

                    console.log(button);

                    $('.pressed').removeClass('pressed');

                    var rawType = button.type == "button" ? "buttons" : "axes";
                    var bMap = gpadMap['rawToButton'][rawType][button.number];
                    if(bMap === undefined){
                        console.log(gpadMap['rawToButton'], gpadMap['rawToButton'][rawType], rawType, button.number);
                    }
                    var additionalStyle = " ";

                    if(bMap && bMap.subType){

                        if (bMap.subType == "y") {
                            additionalStyle = button.value > 0 ? "down" : "up";
                        } else if (bMap.subType == "x") {
                            additionalStyle = button.value > 0 ? "right" : "left";
                        }
                    }

                    $('.gamepad-button.gamepadclass-' + bMap.bid).addClass('pressed ' + additionalStyle);
                    inpoot.utils.poll.setTimeout(function(){
                        $('.gamepad-button.gamepadclass-' + bMap.bid).removeClass('pressed').removeClass(additionalStyle);
                    }, 350);

                    getNextButton();
                 });
             };

             monitor();
        };

        //behavior
        var gpadPP = function (item) {

            //figure out which config set to load
            var padConfigs = inpoot.gamepads[gpad.gpadType];

            var gamepads = getGamePads();

            var thisPad;
            for(var i=0; i < gamepads.length; i++){
                if(gamepads[i].gamepad.gpadType == gpad.gpadType){
                    thisPad = gamepads[i];
                    continue;
                }
            }

            //we need to wait to render the actual gamepad
            inpoot.utils.poll.setTimeout(function(){

                var uiNode = $(item.nodes[0]),
                    face;

                mainNode = uiNode;
                uiNode.find('.inpoot-top-option').click(function(){
                    launch_calibrate();
                });

                for(var button in padConfigs.button) {
                    var thisButton = padConfigs.button[button];
                    face = thisButton.face || "front";
                    $('.inpoot-gamepad-calibrate-face.' + face).append('<span class="gamepad-button gamepadclass-' + button  + " " + (thisButton.style || "") + ' ' + (thisButton.bclass || "") + ' " style="left:'+thisButton.x+'%; top:'+thisButton.y+'%;"><span class="gamepad-button-inner">'+ (thisButton.text || "&nbsp;") + '<span class="gamepad-button-inner-dec"></span></span></span>');
                }

                for(var axis in padConfigs.axis_dual) {
                    var thisAxis = padConfigs.axis_dual[axis];
                    face = thisAxis.face || "front";
                    $('.inpoot-gamepad-calibrate-face.' + face).append('<span class="gamepad-button gamepadclass-' + axis  + " " + (thisAxis.style || "") + ' ' + (thisAxis.bclass || "") + ' " style="left:'+thisAxis.x+'%; top:'+thisAxis.y+'%;"><span class="gamepad-button-inner">'+ (thisAxis.text || "&nbsp;")+'<span class="gamepad-button-inner-dec"></span></span></span>');
                }

                $('.inpoot-gamepad-calibrate-layout').fadeIn();

                var gpadContainer = $('.inpoot-gamepad-calibrate-gamepad-3d-holder');

                gpadContainer.addClass('turned');

                //keep rotating the gamepad
                inpoot.utils.poll.setInterval(
                    function(){
                        if(gpadContainer.hasClass('turned')){
                            gpadContainer.removeClass('turned');
                        } else {gpadContainer.addClass('turned');}
                    },
                4000,'gpad-rotation');

                //lastly we can start monitoring input
                monitorCallibration();

            },300, 'gpad-buttons');


            //figure out which config set to load
            var padConfigs = inpoot.gamepads[gpad.gpadType];

            //when the user clicks all we need to setup button mapping for all keys
            $('.inpoot-gamepad-calibrate-panel-button.all').click(function(){

                stopMapping();

                var buttonsToMap = [];
                var addAButton = function (button, btype, style, text) {
                    buttonsToMap.push({type:btype, bid:button, style:style, text:text});
                };

                for(var button in padConfigs.button){
                    addAButton(button, 'button');
                }

                for(var axis in padConfigs.axis_dual){
                    addAButton(axis, 'axis_dual', 'up', 'up');
                    addAButton(axis, 'axis_dual', 'down', 'down');
                    addAButton(axis, 'axis_dual', 'left', 'left');
                    addAButton(axis, 'axis_dual', 'right', 'right');
                }

                mapButtons(buttonsToMap);
            });

            //stop mapping when this button is clicked
            $('.inpoot-gamepad-calibrate-gamepad-3d-presskey .inpoot-x-out').click(function(){
                stopMapping();
                monitorCallibration();
            });

            //the behabior for the buttons
            var addButtonBehavior = function (button, thisButton, btype) {

                var text = thisButton.name ? thisButton.name : button;
                var newButton = $('<div class="button-configure">' + text + '</div>');

                newButton.hover(function(){$('.gamepadclass-' + button).addClass('pressed');}, function(){$('.gamepadclass-' + button).removeClass('pressed');});

                newButton.click(function(){

                    stopMapping();

                    if (btype != 'axis_dual') {
                        mapButtons([{type: btype,bid: button}]);
                    } else {
                        mapButtons([
                            {type: btype, bid: button, style:'up', text:'up'},
                            {type: btype, bid: button, style:'down', text:'down'},
                            {type: btype, bid: button, style:'left', text:'left'},
                            {type: btype, bid: button, style:'right', text:'right'}
                        ]);
                    }
                });

                $('.inpoot-gamepad-calibrate-panel-inner-content').append(newButton);
            };

            for(var button in padConfigs.button){
                addButtonBehavior(button, padConfigs.button[button], 'button');
            }

            for(var axis in padConfigs.axis_dual){
                addButtonBehavior(axis, padConfigs.axis_dual[axis], 'axis_dual');
            }

        };

        //render the main UI
        inpoot.utils.modal.show({template: 'inpoot.gamepad-calibrate', data: gpad, behavior: gpadPP});
    };

    /*========= GAMEPADS MENU ========*/

    var launch_calibrate = function () {

        var oldList = [];

        var mainNode;
        var gamepadsPP = function (item) {
            var uiNode = $(item.nodes[0]);
            mainNode = uiNode;
            uiNode.find('.inpoot-top-option').click(function(){
                launch_main();
            });

            uiNode.find('.inpoot-help').toggle(
                function(){
                    $('.inpoot-main-gamepad-options-summary').stop(true,true).slideDown(function(){
                        inpoot.utils.modal.expand();
                    });
                },
                function() {
                    $('.inpoot-main-gamepad-options-summary').stop(true,true).slideUp(function(){
                        inpoot.utils.modal.expand();
                    });
                }
            );
        };

        //render the main UI
        inpoot.utils.modal.show({template:'inpoot.gamepad-content', data:{}, behavior:gamepadsPP});

        var numPads = gamepads.length;

        var gamepadPP = function (item) {
            $(item.nodes[0]).click(function(){
                if($(this).hasClass('active')){
                    launch_calibrate_gpad(item.data);
                }
            });
        };

        var redrawGamepads = function (displayList) {
            mainNode.find('.inpoot-gamepad-list').html('');
            $.tmpl('inpoot.gamepad-gamepad', {gamepads: displayList, gamepadPP: gamepadPP}).appendTo(mainNode.find('.inpoot-gamepad-list'));
        };

        //get the gamepads again
        var refreshPads = function () {

            var newList = [];

            gamepads = getGamePads();

            var storedGamepads = $.storage.getObject('storedGamepads') || [];

            for (var i=0; i < storedGamepads.length; i++){
                newList.push({
                   id: storedGamepads[i].id,
                   displayName: storedGamepads[i].displayName,
                   gpadType: storedGamepads[i].gpadType,
                   active: false
                });
            }

            for(var idx=0; idx < gamepads.length; idx++) {

                var found = false;
                for(var j=0; j < newList.length; j++){
                    if(newList[j].id == gamepads[idx].gamepad.id){
                        newList[j].active = true;
                        found = true;
                    }
                }

                if(!found){
                    newList.push({
                        id: gamepads[idx].gamepad.id,
                        displayName: gamepads[idx].gamepad.displayName,
                        active: true,
                        gpadType: gamepads[idx].gamepad.gpadType
                    });
                    storedGamepads.push({
                        id: gamepads[idx].gamepad.id,
                        displayName: gamepads[idx].gamepad.displayName,
                        gpadType: gamepads[idx].gamepad.gpadType
                    });
                    $.storage.setObject('storedGamepads', storedGamepads);
                }
            }

            var refresh = false;

            if(newList.length != oldList.length){
                refresh = true;
            }

            if(!refresh){

                var matches = 0;

                for(var n=0; n < newList.length; n++){
                    for(var p=0; p < oldList.length; p++){
                         if(oldList[p].id == newList[n].id){
                             if(oldList[p].active == newList[n].active){
                                 matches++;
                             }
                         }
                    }
                }

                if(matches != newList.length){
                    refresh = true;
                }
            }

            if(refresh){
                redrawGamepads(newList);
                inpoot.utils.modal.expand();
            }

            oldList = newList;
        };

        //draw it at least once
        redrawGamepads();

        //keep polling for input
        inpoot.utils.poll.setInterval(refreshPads,200);
    };

    /*========= PLAYAS MENU ========*/

    var launch_players = function () {

        var globalUINode;

        var savePlayers = function (playersObj) {
            $.storage.setObject('inpoot_stored_players', playersObj);
        };

        var getGamePadAxes = function (gamepadType) {

            var allAxes = inpoot.gamepads['XBOX 360']['axis_dual'];

            var axisList = [];

            for(var axis in allAxes) {
                if(allAxes.hasOwnProperty(axis)){
                    axisList.push({
                        axisName: axis,
                        axisTitle: allAxes[axis].name,
                        axisType: 'y'
                    });
                }
            }

            return axisList;
        };

        var updatePlayer = function (playerNum, playerObj, callBack) {

            var storedPlayers = $.storage.getObject('inpoot_stored_players') || [];

            var foundIndex = -1;

            //search through them for our expected number
            for (var j = 0; j < storedPlayers.length; j++) {
                if (storedPlayers[j].number == playerNum) {
                    foundIndex = j;
                }
            }

            //they should be found so save over
            if(foundIndex != -1){
                storedPlayers[foundIndex] = playerObj;

                //and save all
                savePlayers(storedPlayers);

                if(callBack){
                    callBack();
                }
            }
        };

        var getActionMapById = function (actionMapId) {

            var allActionMaps = $.storage.getObject('inpoot_action_mappings') || [];
            for(var i=0; i < allActionMaps.length; i++){
                if(allActionMaps[i].id === actionMapId){
                    return allActionMaps[i];
                }
            }

            return false;
        };

        var saveThisPlayer = function (playerObj) {

            var allPlayers = $.storage.getObject('inpoot_stored_players');

            for(var player in allPlayers){

                if(allPlayers[player].number == playerObj.number){
                    allPlayers[player] = playerObj;
                    savePlayers(allPlayers);
                    return;
                }
            }
        };

        var drawPlayers = function () {

            //grab the array of playas
            var storedPlayers = $.storage.getObject('inpoot_stored_players') || [];

            //populate drawable players
            inpoot.players = [];

            //this loop makes sure we have an entry for all players < maxPlayers
            for(var i = 0; i < maxPlayers; i++){

                var foundIndex = -1;

                //we push them in in player order
                for (var j = 0; j < storedPlayers.length; j++) {
                    if (storedPlayers[j].number == i + 1) {
                        foundIndex = j;
                    }
                }

                //if we already have one stored then use it
                if(foundIndex != -1){

                    //update action map info (it could have changed)
                    var playerActionMap = getActionMapById(storedPlayers[foundIndex].actionMapId);

                    if(playerActionMap){
                        storedPlayers[foundIndex].title = playerActionMap.name;
                        storedPlayers[foundIndex].gamepad = playerActionMap.gamepad;
                        storedPlayers[foundIndex].keyboard = playerActionMap.keyboard;
                        storedPlayers[foundIndex].mouse = playerActionMap.mouse;
                    }

                    inpoot.players.push(storedPlayers[foundIndex]);

                } else {

                    //else we need to add a new blank one that can be configured
                    inpoot.players.push({
                        number: i + 1,
                        title: false,
                        actionMapId: false,
                        keyboard: false,
                        mouse: false,
                        gamepad: false,
                        options: {},
                        gamepadIndex: false
                    });
                }
            }

            //save the players
            savePlayers(inpoot.players);

            //render the players
            $.tmpl('inpoot.player', inpoot.players, {rendered:eachPlayerPP}).appendTo(globalUINode.find('.inpoot-players-list').html(''));
        };

        var playerPP = function (item) {

            var uiNode = $(item.nodes[0]);
            globalUINode = uiNode;

            //wire up buttons
            uiNode.find('.inpoot-top-option').click(function(){
                launch_main();
            });

            drawPlayers();
        };

        //behavior for each listed player item
        var eachPlayerPP = function (item) {

            var uiNode = $(item.nodes[0]);

            //if they don't have an actionMap set then show an error
            if(item.data.actionMapId === false){
                uiNode.addClass('player-error');
            }

            //when someone wants to change the action mapping
            uiNode.find('.inpoot-player-actionmap').click(function() {

                var actionOptions = [];
                var action_maps = $.storage.getObject('inpoot_action_mappings');

                //push in a way for them to remove the mapping
                actionOptions.push({text:'[ NONE ]', value:false, data:{name:false, gamepad:false, mouse:true, keyboard:true, id:false}});

                for(var i=0; i < action_maps.length; i++) {
                    var name = action_maps[i].name;
                    actionOptions.push({text:name, value:action_maps[i].name, data: action_maps[i]});
                }

                //this is the container that will house the popup
                var gContainer = $('.dumbBox-content');

                var playerSelectBox = inpoot.utils.optionBox({
                    title: 'Select action mapping for this player',
                    container: gContainer,
                    options: actionOptions,
                    callBack: function(chosenOpt){
                        item.data.title = chosenOpt.data.name;
                        item.data.actionMapId = chosenOpt.data.id;
                        item.data.gamepad = chosenOpt.data.gamepad;
                        item.data.keyboard = chosenOpt.data.keyboard;
                        item.data.mouse = chosenOpt.data.mouse;
                        updatePlayer(item.data.number, item.data, drawPlayers);
                    }
                });
            });

            //if we have a gamepad then we need to populate the gamepad selection box
            if (item.data.gamepad) {

                //set the first value for the gamepad index
                var gpadList = getRawPads();
                if(item.data.options.gpadIndex !== false && gpadList[item.data.options.gpadIndex] && gpadList[item.data.options.gpadIndex].gpadType == item.data.gamepad){
                    uiNode.find('.inpoot-player-gamepad-index').html('Gamepad Slot ' + (parseInt(item.data.options.gpadIndex, 10) + 1));
                } else {

                    item.data.options.gpadIndex = false;
                    saveThisPlayer(item.data);
                    uiNode.find('.inpoot-player-gamepad-index').html('select gamepad');
                    // typo?
                    //(item.data.options.gpadIndex !== false)
                    uiNode.addClass('player-error');
                }
            }

            //check for if there is a gamepad and then wire up the selection box
            uiNode.find('.inpoot-player-gamepad-index').click(function() {

                var gpadIndexes = [];
                var hasOne = false;

                for(var i=0; i < 4; i++) {

                    if(gpadList[i]){

                        var disabled = item.data.gamepad != gpadList[i].gpadType;

                        if(!disabled){
                            hasOne = true;
                        }
                        gpadIndexes.push({value:i, text:'Gamepad Slot ' + (i + 1) + " : " + gpadList[i].gpadType, disabled:disabled});

                    } else {

                        gpadIndexes.push({value:i, text:'Gamepad Slot ' + (i + 1) + " : EMPTY", disabled:true});
                    }
                }

                //this is the container that will house the popup
                var gContainer = $('.dumbBox-content');

                var title = hasOne ? false : 'Could not detect gamepads of this type. Make sure your (' + item.data.gamepad + ') gamepad is on and press buttons to activate it.';

                var playerSelectBox = inpoot.utils.optionBox({
                    title:title,
                    container: gContainer,
                    options: gpadIndexes,
                    callBack: function(chosenOpt){
                        item.data.options.gpadIndex = chosenOpt.value;
                        uiNode.find('.inpoot-player-gamepad-index').html('Gamepad Slot ' + (parseInt(item.data.options.gpadIndex, 10) + 1));
                        uiNode.removeClass('player-error');
                        saveThisPlayer(item.data);
                    }
                });
            });

            var showPlayerOptions = function () {

                $(this).html('close');

                var optionsNode = uiNode.find('.inpoot-player-options');
                optionsNode.html('');

                //====> look for each type of option set and add it
                var optionSets = 0;

                //Do we need to allow the user to invert their axis?
                if(item.data.gamepad && item.data.gamepad != "false"){

                    var axisList = getGamePadAxes(item.data.gamepad);

                    //now check the options to get the values
                    for(var i=0; i < axisList.length; i++){

                        var thisName = axisList[i].axisName;
                        item.data.options.axes = item.data.options.axes || {};
                        item.data.options.axes[thisName] = item.data.options.axes[thisName] === undefined ? false : item.data.options.axes[thisName];

                        axisList[i]['axisInverted'] = item.data.options.axes[thisName];

                    }

                    var axisPP = function (axisItem) {

                        var axisItemNode = $(axisItem.nodes[0]);
                        var axisData = axisItem.data;
                        var axisId = axisItem.data.axisName;

                        axisItemNode.click(function(){

                           if(axisData.axisInverted){
                               axisData.axisInverted = false;
                               $(this).find('.inpoot-player-invert-axis-value').html('NORMAL');
                               $(this).removeClass('inverted-true').addClass('inverted-false');
                           } else {
                               axisData.axisInverted = true;
                               $(this).find('.inpoot-player-invert-axis-value').html('INVERTED');
                               $(this).removeClass('inverted-false').addClass('inverted-true');
                           }

                           //now we save the changes
                           item.data.options.axes[axisId] = axisData.axisInverted;
                           saveThisPlayer(item.data);
                        });


                    };

                    if (axisList.length > 0) {
                        optionSets++;

                        //append the title
                        $.tmpl('inpoot.player-options-title', {title:'Invert Gamepad Y Axes'}).appendTo(optionsNode);

                        //append the options
                        $.tmpl('inpoot.player-invert-axis', axisList, {rendered: axisPP}).appendTo(optionsNode);
                    }
                }

                //if we had no options then show it
                if(optionSets === 0) {
                    $.tmpl('inpoot.player-options-title', {title:'No additional options for this player'}).appendTo(optionsNode);
                }

                optionsNode.stop(true,true).show(0,inpoot.utils.modal.expand);
            };

            var hidePlayerOptions = function () {
                $(this).html('options');
                uiNode.find('.inpoot-player-options').stop(true,true).hide(0,inpoot.utils.modal.expand);
            };

            //when they click options
            uiNode.find('.inpoot-player-options-button.options').toggle(showPlayerOptions, hidePlayerOptions);
        };

        //render the main template and add the behavior
        inpoot.utils.modal.show({template:'inpoot.player-content', data:{}, behavior:playerPP});

        //now setup some logic to scan for new gamepads
        var oldLength = getGamePads().length;
        var checkForGamePadUpdates = function () {
            var gList = getGamePads();
            if (gList.length != oldLength) {
                oldLength = gList.length;
                drawPlayers();
                $('.inpoot-option-box-wrapper').remove();
                $('.inpoot-option-box-screen').remove();
            }
        };

        //start a scan so the users can press buttons on their gamepads and activate them from this screen
        inpoot.utils.poll.setInterval(checkForGamePadUpdates,50,'player-gamepad-scanning');
    };

    //entry point to launch the options modal
    inpoot.openMenu = function () {
        uiOpen = true;
        launch_main();
    };


    //========================================================================================================
    //           GLOBAL UTILITY FUNCTIONS INCLUDING MODAL HANDLING + GLOBAL TIMEOUT INTERVAL HANDLING
    //========================================================================================================

    inpoot.utils = {

        truncate : function (text, cutoff) {
            if(text.length > cutoff){
                return text.substr(0,cutoff -3) + '...';
            } else {
                return text;
            }
        },

        optionBox : function (options_in) {

            var that = {};
            that.container = options_in.container;
            that.options = options_in;

            //the close function
            that.close = function () {
                $('.inpoot-option-box-wrapper').remove();
                $('.inpoot-option-box-screen').remove();
                if(that.options.onClose){
                    that.options.onClose();
                }
            };

            //kill old options boxes
            that.close();

            //create the containers
            var optionScreen = $('<div class="inpoot-option-box-screen"></div>');
            var optionBoxWrapper = $('<span class="inpoot-option-box-wrapper"></span>');
            var optionBox = $('<div class="inpoot-option-box"></div>');
            var optionContent = $('<div class="inpoot-option-box-content"></div>');
            var optionClose = $('<div class="inpoot-option-box-close">cancel</div>');
            var optionTitle = that.options.title ?
                $( '<div class="inpoot-option-box-title">' + that.options.title + '</div>' ) :
                $( '<div></div>' ) ;

            //build up the container
            optionBoxWrapper.append(optionBox);
            optionBox.append(optionClose);
            optionBox.append(optionTitle);
            optionBox.append(optionContent);

            //if we have a max height
            if(that.options.maxHeight){
                optionContent.css('max-height', that.options.maxHeight + 'px').css('overflow-y','auto');
            }

            //add behavior for closing
            optionClose.click(function(){
                that.close();
            });

            var getClickHandler = function (opt) {
                return function(e){
                    e.preventDefault();
                    if (!opt.disabled) {
                        that.close();
                        that.options.callBack.apply(that, [opt]);
                    }
                };
            };

            //add in the options and wire up click handlers
            for(var i=0; i < that.options.options.length; i++){

                var disabledText = that.options.options[i].disabled ? ' disabled ' : '';
                var thisOption = $('<div class="inpoot-option-box-option '+ disabledText +'"><a href="#">'+ that.options.options[i].text +'</a></div>');
                thisOption.click(getClickHandler(that.options.options[i]));

                thisOption.appendTo(optionContent);
            }

            //put it in the UI
            $('.dumbBoxWrap .vertical-offset').append(optionBoxWrapper);

            //Show the screen and fade her in
            optionScreen.appendTo($('.dumbBoxWrap .vertical-offset'));
            optionBox.stop(true,true).fadeIn('fast');
        },

        styledSelect : function (options_in) {

            var that = {};
            var callBack = options_in.callBack;
            that.container = options_in.container;
            that.options = options_in.options;

            var selectBox = {};

            //this is the container that will house the popup
            var gContainer = $('.dumbBox-content');

            var selected = that.options[0];

            //check for selected
            for(var i = 0 ; i < that.options.length; i++){
                if(that.options[i].value == options_in.selected){
                    selected = that.options[i];
                }
            }

            //create the replacement markup
            var selectContainer = $('<span class="styled-select-container"></span>');
            var selectValue = $('<span class="styled-select-value"></span>');
            var selectOptions = $('<span class="styled-select-options"></span>');
            var leftImage = $('<span class="style-select-left-image"></span>');
            var rightImage = $('<span class="style-select-right-image"></span>');
            selectContainer.append(leftImage);
            selectContainer.append(selectValue);
            selectContainer.append(rightImage);
            selectContainer.append(selectOptions);

            that.container.append(selectContainer);

            that.setValue = function (val) {

                //check for selected
                for(var i = 0 ; i < that.options.length; i++){
                    if(that.options[i].value == val){
                        selected = that.options[i];
                    }
                }

                selectValue.html(inpoot.utils.truncate(selected.text, 25));
                selectValue.removeClass().addClass('styled-select-value');
                if(selected.style){
                    selectValue.addClass(selected.style);
                }
            };

            that.getValue = function () {
                return selected.value;
            };

            that.container.click(function(){

                selectBox = inpoot.utils.optionBox({
                    title: undefined,
                    container: gContainer,
                    options: that.options,
                    callBack: function(chosenOpt){

                        var doCallBack = function(){
                            selected = chosenOpt;
                            callBack(chosenOpt);
                            selectContainer.removeClass('choosing');
                            selectContainer.find('.styled-select-value').removeClass().addClass('styled-select-value').addClass(chosenOpt.style).html(inpoot.utils.truncate(chosenOpt.text, 25));
                        };

                        var matchingOpt;
                        for (var j = 0; j < that.options.length; j++) {
                            if (that.options[j].value == chosenOpt.value) {
                                matchingOpt = that.options[j];
                                break;
                            }
                        }

                        //If the current value is not in the ifNot list then don't do a confirm
                        var notInIfNotList = (chosenOpt.ifNot && chosenOpt.ifNot.indexOf(selected.value) != -1);

                        //there is a warning we need to stop and confirm
                        if (matchingOpt.message && chosenOpt.value != selected.value && !notInIfNotList) {

                            selectBox = inpoot.utils.optionBox({
                                title:  matchingOpt.message,
                                container: gContainer,
                                options: [{
                                    text: 'CANCEL',
                                    value: 'cancel'
                                }, {
                                    text: 'OK',
                                    value: 'okay'
                                }],
                                callBack: function(cOpt){
                                    if (cOpt.value == "okay") {

                                        doCallBack();

                                    }
                                }
                            });

                        } else {

                            doCallBack();
                        }
                    }
                });
            });

            //set us up initially with the currently selected value
            that.setValue(selected.value);

            return that;
        },

        modal : {
            showing:false,
            buttonPP : function (item) {

                var button = $(item.nodes[0]);
                button.find('a').click(function(e){
                   e.preventDefault();

                   if(item.data.click){
                       item.data.click(item.data);
                   }
                });
            },
            expand : function () {

                //wait a tick to sure the dom has the right width and height
                setTimeout(function(){

                    var content = $('.dumbBox-content');
                    var content_wrap = $('.dumbBox');

                    var contentHeight = content.height();
                    var contentWidth = content.width();

                    content_wrap.css('height', contentHeight);
                    content_wrap.css('width', contentWidth);

                    //the css is setup to transition over 500ms so wait a sec before fading in
                    setTimeout(function(){
                        content.stop(true,true).fadeIn(200);
                    },200);

                },50);
            },
            newContent : function (configs, noFadeContent) {

                var that = this;

                var behavior = configs.behavior ? configs.behavior : $.noop;
                var data = configs.data ? configs.data : {};

                var content = $('.dumbBox-content');
                var content_wrap = $('.dumbBox');

                var loadContent = function () {

                    content.stop(true,true).hide();
                    content.html('');

                    //render the new content
                    $.tmpl(configs.template, data, {rendered:behavior}).appendTo(content);

                    that.expand();
                };

                //sometimes we want to fade before killing the content
                if(!noFadeContent){
                    content.stop(true,true).fadeOut(500, loadContent);
                } else {
                    loadContent();
                }
            },
            show : function (configs) {

                var that = this;

                //when we switch views we should purge all setTimeouts and setIntervals
                inpoot.utils.poll.purge();

                if (!inpoot.utils.modal.showing) {
                    //put the markup in
                    $.tmpl('inpoot.modal').appendTo($('body'));

                    var wrap = $('.dumbBoxWrap');
                    var screen = $('.dumbBoxOverlay');
                    var content_wrap = $('.dumbBox');
                    var content = $('.dumbBox-content');
                    var buttons = $('.dumbBox-buttons');

                    //now fade everything in
                    wrap.show();
                    screen.stop(true, true).fadeIn(100, function(){
                        content_wrap.stop(true, true).fadeIn(200, function(){
                            that.newContent(configs, true);
                            inpoot.utils.modal.showing = true;
                        });
                    });

                    $('.vertical-offset').click(function(e){
                        if($(e.target).hasClass('vertical-offset')){
                            that.hide();
                        }
                    });
                    screen.click(that.hide);

                } else {

                    that.newContent(configs, true);
                }
            },
            hide : function () {

                var that = this;

                inpoot.utils.poll.purge();
                inpoot.utils.modal.showing = false;

                var wrap = $('.dumbBoxWrap');
                var screen = $('.dumbBoxOverlay');
                var content_wrap = $('.dumbBox');
                var content = $('.dumbBox-content');
                var buttons = $('.dumbBox-buttons');

                //hide everything
                content_wrap.stop(true,true).hide();
                screen.stop(true,true).fadeOut(200, function () {
                    //clear everything
                    content.html('');
                    buttons.html('');
                    $('.dumbBoxWrap').remove();
                });

                //set some flags to make sure the plugin knows we need to refresh
                //and the tick function no longer needs to worry about the UI
                uiOpen = false;
                inpoot.refreshParams();
            }
        },
        poll : {
            pollId: 0,
            repository:{},
            getPollId: function () {
                this.pollId++;
                return 'poll-' + this.pollId;
            },
            clear: function (pollId) {
                var thisPoll = this.repository[pollId];

                if (thisPoll) {

                    if (thisPoll.type == "timeout") {
                        clearTimeout(thisPoll.pollObj);
                    }
                    else {
                        clearInterval(thisPoll.pollObj);
                    }

                    delete this.repository[pollId];
                }
            },
            purge: function () {
                for(var poll in this.repository){
                    var thisPoll = this.repository[poll];
                    if(thisPoll.type == "timeout"){
                        clearTimeout(thisPoll.pollObj);
                    } else {
                        clearInterval(thisPoll.pollObj);
                    }

                    delete this.repository[poll];
                }
            },
            setTimeout: function (callBack, timeAmount, pollId) {
                pollId = pollId || this.getPollId();
                var thisPoll = {
                    type:'timeout',
                    pollObj: setTimeout(callBack,timeAmount)
                };

                this.repository[pollId] = thisPoll;
            },
            setInterval: function (callBack, timeAmount, pollId) {
                pollId = pollId || this.getPollId();
                var thisPoll = {
                    type:'interval',
                    pollObj: setInterval(callBack,timeAmount)
                };

                this.repository[pollId] = thisPoll;
            }
        }
    };


    //========================================================================================================
    //                                 JQUERY TMPL TEMPLATES FOR EACH VIEW
    //========================================================================================================


    //=================> Main Menu

    $.template('inpoot.main-content',[
        '<div class="inpoot-main-wrapper">',
            '<div class="inpoot-main-menu">',
                '<div class="inpoot-main-option players">',
                    '<span class="inpoot-main-options-image"><span class="inpoot-input-icon players"></span></span>',
                    '<span class="inpoot-main-options-title">Players</span>',
                '</div>',
                '<div class="inpoot-main-option mappings">',
                    '<span class="inpoot-main-options-image"><span class="inpoot-input-icon gamepad"></span></span>',
                    '<span class="inpoot-main-options-title">Mappings</span>',
                '</div>',
                '<div class="inpoot-main-option settings">',
                    '<span class="inpoot-main-options-image"><span class="inpoot-input-icon settings"></span></span>',
                    '<span class="inpoot-main-options-title">calibrate</span>',
                '</div>',
            '</div>',
        '</div>'
    ].join(''));


    //=================> Edit an Action Map

    $.template('inpoot.action_map', [
        '<div class="inpoot-edit-action-map-wrapper">',
             '<div class="inpoot-top">',
                '<span class="inpoot-top-title">',
                    'Edit Action Map',
                '</span>',
                '<span class="inpoot-top-options">',
                    '<span class="inpoot-top-option">back</span>',
                '</span>',
            '</div>',
            '<div class="inpoot-main-gamepad-options-message inpoot-no-select">',
                '<div class="inpoot-options-left">',
                    '<input type="text" value="${actionMap.name}" id="inpoot-action-edit-name" size="16"/>',
                '</div>',
                '<div class="inpoot-options-right">',
                    '<div class="inpoot-input-selector keyboard">',
                    '</div>',
                    '<div class="inpoot-input-selector mouse">',
                    '</div>',
                    '<div class="inpoot-input-selector gamepad">',
                    '</div>',
                '</div>',
                '<div class="inpoot-options-clear"></div>',
            '</div>',
            '<div class="inpoot-map-form">',
                '<div class="inpoot-map-form-left"><div class="inpoot-map-form-left-inner"></div></div>',
                '<div class="inpoot-map-form-middle"><div class="inpoot-map-form-middle-inner"></div></div>',
                '<div class="inpoot-map-form-left-hidden"><div class="inpoot-map-form-left-hidden-inner">',
                    '<div class="inpoot-editing-inputs-title"></div>',
                    '<div class="inpoot-editing-inputs-close"><div class="inpoot-close-edit-mapping">CLOSE</div></div>',
                '</div></div>',
                '<div class="inpoot-map-form-right"><div class="inpoot-map-form-right-inner"></div></div>',
            '</div>',
        '</div>'
    ].join(''));

    $.template('inpoot.action_map.action_list', [
        '<div class="inpoot-edit-action-map-list-group">',
             '<div class="inpoot-edit-action-map-list-group-name">${name}<span class="inpoot-selected-arrow"></span></div>',
        '</div>'
    ].join(''));

     $.template('inpoot.action_map.action_list_item', [
        '<div class="inpoot-edit-action-map-list-group-action">{{if (actionId != descr && descr != undefined) }} ${inpoot.utils.truncate(descr, 22)} {{else}} ${inpoot.utils.truncate(actionId, 22)} {{/if}}<span class="inpoot-selected-arrow"></span></div>'
     ].join(''));

    $.template('inpoot.action_map.action_list_mappings', [
        '<div class="inpoot-edit-action-map-list-mappings">',
             'list-of-mappings',
        '</div>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_mapping', [
        '<div class="inpoot-edit-action-map-edit_mapping input-count-${inputCount}">',
            '{{if (actionMap.keyboard && actionMap.keyboard != "false")}}',
                '<div class="inpoot-edit-mapping-gather-inputs keyboard">',
                    '<div class="inpoot-edit-mapping-gather-title inpoot-input-icon-xsmall-container"><span class="inpoot-input-icon-xsmall"></span>KEYBOARD  <span class="inpoot-gather-add-button">PRESS KEYS</span></div>',
                    '<div class="inpoot-edit-mapping-gather-input-list">',
                    '</div>',
                '</div>',
            '{{/if}}',
            '{{if (actionMap.gamepad && actionMap.gamepad != "false")}}',
                '<div class="inpoot-edit-mapping-gather-inputs gamepad">',
                    '<div class="inpoot-edit-mapping-gather-title inpoot-input-icon-xsmall-container"><span class="inpoot-input-icon-xsmall"></span>GAMEPAD <span class="inpoot-gather-add-button active">CLICK -or- PRESS BUTTONS</span></div>',
                    '<div class="inpoot-edit-mapping-gather-input-list"></div>',
                '</div>',
            '{{/if}}',
            '{{if (actionMap.mouse && actionMap.mouse != "false")}}',
                '<div class="inpoot-edit-mapping-gather-inputs mouse">',
                    '<div class="inpoot-edit-mapping-gather-title inpoot-input-icon-xsmall-container"><span class="inpoot-input-icon-xsmall"></span>MOUSE <span class="inpoot-gather-add-button active">CLICK to add mouse input</span></div>',
                    '<div class="inpoot-edit-mapping-gather-input-list"></div>',
                '</div>',
            '{{/if}}',
        '</div>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_action_map_item',[
        '<div class="inpoot-edit-mapping-gather-input-list-item"><span class="inpoot-x-out"></span>${name}</div>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_action_inputs', [
        '<div>',
            '<div class="inpoot-edit-action-top"><span class="inpoot-edit-action-title">${descr}</span> {{if actionId != descr}}<span class="inpoot-edit-action-title-actionid"> : ${actionId} </span>{{/if}}</div>',
            '<div class="inpoot-main-gamepad-edit-action-options"> [+] New Input Combination </div>',
            '<div class="inpoot-main-gamepad-edit-action-options-list"></div>',
        '</div>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_action_input', [
        '<div class="inpoot-edit-action-keys">',
            '<div class="inpoot-x-out"></div>',
            '<div class="inpoot-edit-action-keys-list">',
                '{{if inputs.length == 0}}',
                    '<span class="inpoot-edit-action-keys-list-and edit">(click to edit)</span> ',
                '{{else}}',
                    '{{tmpl(inputs) "inpoot.action_map.action_edit_action_input_listing"}}',
                '{{/if}}',
            '</div>',
        '</div>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_action_input_listing', [
        '<span class="inpoot-input-item ${type}"><span class="inpoot-input-icon-xsmall-container"><span class="inpoot-input-listing-title-type inpoot-input-icon-xsmall">&nbsp;</span><span class="inpoot-input-listing-title">${text}</span></span></span>'
    ].join(''));

    $.template('inpoot.action_map.action_edit_action_input_hidden', [
        '<div class="inpoot-edit-action-keys hide-action-inputs">',
            '<div class="inpoot-x-out"></div>',
            '<div class="inpoot-edit-action-keys-list">{{if inputs.length == 0}} <span class="inpoot-edit-action-keys-list-and edit">(click to edit)</span> {{else}} yo {{/if}}</div>',
        '</div>'
    ].join(''));

    //=================> Action Mappings Menu

    $.template('inpoot.mappings', [
        '<div class="inpoot-mappings-wrapper">',
             '<div class="inpoot-top">',
                '<span class="inpoot-top-title">',
                    'view and edit stored input to action maps',
                '</span>',
                '<span class="inpoot-top-options">',
                    '<span class="inpoot-top-option">back</span>',
                '</span>',
            '</div>',
            '<div class="inpoot-main-gamepad-options-message">',
                '<span class="inpoot-message-button">[+] Create New Mapping</span>',
            '</div>',
            '<div class="inpoot-mappings-list"></div>',
        '</div>'
    ].join(''));

    $.template('inpoot.mapping-list', [
        '<div class="inpoot-mapping-item">',
            '<span class="inpoot-mapping-item-left">',
                '<span class="inpoot-mapping-item-delete">&nbsp;</span>',
                '<span class="inpoot-mapping-item-name">${name} <span class="inpoot-parens">{{if extra}}(${extra}){{/if}}</span></span>',
            '</span>',
            '<span class="inpoot-mapping-item-delete-confirm">',
                '<span class="inpoot-mapping-item-delete-confirm-okay inpoot-mapping-item-delete-confirm-button">Delete</span>',
                '<span class="inpoot-mapping-item-delete-confirm-cancel inpoot-mapping-item-delete-confirm-button">Cancel</span>',
            '</span>',
            '<span class="inpoot-mapping-item-inputs">',
                '{{if keyboard && keyboard != "false"}}',
                    '<span class="inpoot-mapping-item-inputs-input keyboard">&nbsp;</span>',
                '{{/if}}',
                '{{if gamepad && gamepad != "false"}}',
                    '<span class="inpoot-mapping-item-inputs-input gamepad">&nbsp;</span>',
                '{{/if}}',
                '{{if mouse && mouse != "false"}}',
                    '<span class="inpoot-mapping-item-inputs-input mouse">&nbsp;</span>',
                '{{/if}}',
            '</span>',
        '</div>'
    ].join(''));


    //=================> Calibrate a Pad

    $.template('inpoot.gamepad-calibrate',[
        '<div class="inpoot-gamepad-calibrate-wrapper">',
            '<div class="inpoot-top">',
                '<span class="inpoot-top-title">',
                    'press buttons to verify the <span class="inpoot-top-highlight">${gpadType}</span> gamepad\'s configuration',
                '</span>',
                '<span class="inpoot-top-options">',
                    '<span class="inpoot-top-option">back</span>',
                '</span>',
            '</div>',
            '<div class="inpoot-gamepad-calibrate-content">',
                '<div class="inpoot-gamepad-calibrate-layout" style="display:none;">',
                    '<div class="inpoot-gamepad-calibrate-gamepad-3d-holder">',
                        '<div class="inpoot-gamepad-calibrate-face top"></div>',
                        '<div class="inpoot-gamepad-calibrate-face bottom"></div>',
                        '<div class="inpoot-gamepad-calibrate-face left"></div>',
                        '<div class="inpoot-gamepad-calibrate-face right"></div>',
                        '<div class="inpoot-gamepad-calibrate-face front"></div>',
                        '<div class="inpoot-gamepad-calibrate-face back"></div>',
                    '</div>',
                    '<div class="inpoot-gamepad-calibrate-gamepad-3d-presskey">',
                        '<div class="inpoot-gamepad-calibrate-gamepad-3d-presskey-text"></div>',
                        '<div class="inpoot-x-out"></div>',
                    '</div>',
                '</div>',
                '<div class="inpoot-gamepad-calibrate-panel">',
                     '<div class="inpoot-gamepad-calibrate-panel-inner">',
                        '<div class="inpoot-gamepad-calibrate-panel-button all">Click to configure all buttons</div>',
                        '<div class="inpoot-gamepad-calibrate-panel-inner-content">',
                        '</div>',
                     '</div>',
                '</div>',
            '</div>',
        '</div>'
    ].join(''));


    //=================> Gamepads

    //gamepad container
    $.template('inpoot.gamepad-content',[
        '<div class="inpoot-gamepad-wrapper">',
            '<div class="inpoot-top with-icon">',
                '<span class="inpoot-help"></span>',
                '<span class="inpoot-top-title">',
                    'calibrate different gamepad types',
                '</span>',
                '<span class="inpoot-top-options">',
                    '<span class="inpoot-top-option">back</span>',
                '</span>',
            '</div>',
            '<div class="inpoot-gamepad-list"></div>',
        '</div>'
    ].join(''));

    //gamepad
    $.template('inpoot.gamepad-gamepad',[
        '<div class="inpoot-main-gamepad-options-summary">',
            'Verify that your gamepads\' buttons are configured correctly. </br>Not right? Click and edit each type of gamepads\' configurations.',
        '</div>',
        '<div class="inpoot-main-gamepad-options-message">',
            'Hold down keys on your gamepad to load / calibrate gamepads',
        '</div>',
        '{{if gamepads}}',
            '{{tmpl(gamepads, {rendered:gamepadPP}) "inpoot.gamepad-gamepad-indy"}}',
        '{{/if}}'
    ].join(''));

    //gamepad
    $.template('inpoot.gamepad-gamepad-indy',[
        '<div class="inpoot-main-gamepad-option {{if active}}active{{/if}}">',
           '<span class="inpoot-gamepad-option-left">',
                '<span class="inpoot-input-icon gamepad"></span>',
           '</span>',
           '<span class="inpoot-gamepad-option-right">',
                '${displayName}',
                '</br>',
                '<span class="inpoot-gamepad-option-subinfo">',
                    '{{if active}}',
                        'Click to calibrate this type of gamepad',
                    '{{else}}',
                        'To calibrate, ensure your gamepad is on. Hit keys to activate it.',
                    '{{/if}}',
                 '</span>',
           '</span>',
           '<span class="inpoot-status-bar"></span>',
        '</div>'
    ].join(''));


    //=================> Players

    //players container
    $.template('inpoot.player-content',[
        '<div class="inpoot-player-wrapper">',
            '<div class="inpoot-top">',
                '<span class="inpoot-top-title">edit player mappings and options</span>',
                '<span class="inpoot-top-options">',
                    '<span class="inpoot-top-option">back</span>',
                '</span>',
            '</div>',
            '<div class="inpoot-players-list">',
            '</div>',
        '</div>'
    ].join(''));

    //a player
    $.template('inpoot.player',[
        '<div class="inpoot-player inpoot-no-select">',
            '<div class="inpoot-player-info">',
                '<div class="inpoot-player-left">',
                    '<div class="inpoot-player-title">',
                        '<span class="inpoot-player-icon  inpoot-mapping-item-inputs-input players"></span>',
                        '<span class="inpoot-player-number">Player ${number}</span>',
                    '</div>',
                '</div>',
                '<div class="inpoot-player-right">',
                    '<span class="inpoot-player-options-button options inpoot-gather-add-button active">',
                        'options',
                    '</span>',
                    '<span class="inpoot-player-actionmap inpoot-gather-add-button active">',
                        '{{if title}}',
                            '<span class="inpoot-player-actionmap-title">${title}</span>',
                            '<span class="inpoot-player-input-types">',
                                '{{if keyboard && keyboard != "false"}}',
                                    '<span class="keyboard"><span class="inpoot-input-icon-xsmall"></span></span>',
                                '{{/if}}',
                                '{{if mouse && mouse != "false"}}',
                                    '<span class="mouse"><span class="inpoot-input-icon-xsmall"></span></span>',
                                '{{/if}}',
                                '{{if gamepad && gamepad != "false"}}',
                                    '<span class="gamepad"><span class="inpoot-input-icon-xsmall"></span></span>',
                                '{{/if}}',
                            '</span>',
                        '{{else}}',
                            '( click to set action mapping )',
                        '{{/if}}',
                    '</span>',
                    '{{if gamepad && gamepad != "false"}}',
                        '<span class="inpoot-player-options-button inpoot-gather-add-button active inpoot-player-gamepad-index">gpad</span>',
                    '{{/if}}',
                '</div>',
            '</div>',
            '<div class="inpoot-player-options"></div>',
        '</div>'
    ].join(''));

    //a players options for inverting axes
    $.template('inpoot.player-invert-axis', [
        '<span class="inpoot-player-invert-axis inverted-${axisInverted}">',
            '<span class="inpoot-player-invert-axis-name">${axisTitle}</span>',
            '<span class="inpoot-player-invert-axis-value">',
                '{{if axisInverted}}',
                    'INVERTED',
                 '{{else}}',
                    'NORMAL',
                 '{{/if}}',
            '</span>',
        '</span>'
    ].join(''));

    //the title of an options section
    $.template('inpoot.player-options-title',[
        '<div class="inpoot-player-options-title">${title}</div>'
    ].join(''));

    //base markup for the tab panel
    $.template('inpoot.modal',[
        '<div class="dumbBoxWrap">',
            '<div class="dumbBoxOverlay">',
                '&nbsp;',
            '</div>',
            '<div class="vertical-offset">',
                '<div class="dumbBox">',
                    '<div class="dumbBox-content-wrapper">',
                        '<div class="dumbBox-content"></div>',
                    '</div>',
                '</div>',
            '</div>',
        '</div>'
    ].join(''));

    $.template('inpoot.modal.buttons',[
        '<span class="dumbBox-button">',
            '<a href="#">${title}</a>',
        '</span>'
    ].join(''));


})(jQuery);


    //========================================================================================================
    //                          ADDITIONAL JQUERY UTILITIES AND PROTOTYPE ENHANCMENTS
    //========================================================================================================


// simple local storage helper for jquery
// author: Ben Sparks : http://superiorcode.com/
(function($) {

    $.storage = window.localStorage;

    Storage.prototype.setObject = function(key, obj) {
        this.setItem(key, JSON.stringify(obj));
    };

    Storage.prototype.getObject = function(key) {
        var value = this.getItem(key);
        return value && JSON.parse(value);
    };

    Storage.prototype.removeObject = function(key) {
        var value = this.removeItem(key);
        return value && JSON.parse(value);
    };

}(jQuery));

//nice little click to edit on an input
(function($) {

    var methods = {
        init: function(options_in) {

            //create a referance to this object and attach options
            var that = $(this[0]);

            //the defaults
            var defaults = {
                onChange:$.noop,
                defaultText:''
            };

            //merge options
            var options = $.extend({}, defaults, options_in);

            //attach the options
            that.data('plugin-options', options);

            //when focussed select all text
            that.focus(function(){
               if($(this).val() == options.defaultText){
                    $(this).val('');
               }
            });

            //add behavior to the edit name when the user hits escape or enter
            that.keyup(function(e){
                if(e.which == 13 || e.which == 27){
                    $(this).blur();
                }
            });

            //add behavior to the edit name when a blur occurs to check any changes
            that.blur(function(){
                if($.trim($(this).val()) === '') {
                    $(this).val(options.defaultText);
                }
                options.onChange($(this).val());
            });

            return that;
        }
    };

    //Standard jQuery plugin call
    $.fn.inpootEdit = function(incoming) {

        if(this.length === 0) {return;}

        // is this a method or a new instance
        if ( methods[ incoming ] ) {
            return methods[ incoming ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else {
            return methods.init.apply( this, arguments );
        }
    };

}(jQuery));

//if we don't have indexOf for arrays add it
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
        "use strict";
        if (this === null) {
            throw new TypeError();
        }
        var t = new Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 0) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n !== 0 && n != Infinity && n != -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    };
}