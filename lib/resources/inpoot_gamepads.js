// inpoot_gamepads.js

(function(inpoot) {
    "use strict";

    /**
     * gamepads namespace
     * Stores gamepad physical configurations / buttons / layout / and id matching strings
     * idMatches : groups of strings that must be inside the gamepad ID to match the gamepad type.
     * expected inputs:
     *     -buttons : have a return value [0,1] note this could be a trigger
     *     -axis_dual    : have a return value [-1,1] in both the x && y direction
     */
    inpoot.gamepads = {};

    inpoot.gamepads['XBOX 360'] = {
        displayName: 'XBOX 360 Controller',
        idMatches : [
            ['45e', '28e'],
            ['45e', '2a1'],
            ['XInput', 'GAMEPAD']
        ],
        button : {
            dpadUp : {name:'dpad up', style: 'dpadUp', x:30, y:45},
            dpadDown : {name:'dpad down', style: 'dpadDown', x:30, y:65},
            dpadLeft : {name:'dpad left', style: 'dpadLeft', x:25, y:55},
            dpadRight : {name:'dpad right', style: 'dpadRight', x:35, y:55},

            start : {style: 'round_small', text: 's', bclass:'xbox-white',  x:60, y:20},
            back : {style: 'round_small', text: 'b', bclass:'xbox-white', x:40, y:20},

            on : {style: 'round_large', text: 'ON', bclass:'xbox-center', x:50, y:20},

            A : {style: 'round', text: 'A', bclass:'xbox-a', x:80, y:30},
            B : {style: 'round', text: 'B', bclass:'xbox-b', x:86, y:20},
            X : {style: 'round', text: 'X', bclass:'xbox-x', x:74, y:20},
            Y : {style: 'round', text: 'Y', bclass:'xbox-y', x:80, y:10},

            lBumper : {name:'left bumper', style: 'bumper', text: 'LB', face:'top', x:25, y:70},
            rBumper : {name:'right bumper', style: 'bumper', text: 'RB', face:'top', x:75, y:70},

            lStickClick : {name:'left stick click', style: 'stick_click', target: 'lStick', x:20, y:20},
            rStickClick : {name:'right stick click', style: 'stick_click', target: 'rStick', x:70, y:55},

            lTrigger : {name:'left trigger', style: 'trigger', text:'LT', face:'top', x:25, y:20},
            rTrigger : {name:'right trigger', style: 'trigger', text:'RT', face:'top', x:75, y:20}
        },
        axis_dual : {
            lStick : {name:'left stick', style: 'axis', x:20, y:20},
            rStick : {name:'right stick', style: 'axis', x:70, y:55}
        }
    };

    inpoot.gamepads['Playstation 3'] = {
        displayName: 'Playstation 3 Controller',
        idMatches : [
            ['54c', '268']
        ],
        button : {
            dpadUp : {style: 'dpadUp', x:20, y:12},
            dpadDown : {style: 'dpadDown', x:20, y:28},
            dpadLeft : {style: 'dpadLeft', x:15, y:20},
            dpadRight : {style: 'dpadRight', x:25, y:20},

            start : {style: 'round_small', text: 'st', bclass:'ps-mid',  x:60, y:20},
            back : {style: 'round_small', text: 'sl', bclass:'ps-mid', x:40, y:20},

            on : {style: 'round', text: 'ON', bclass:'', x:50, y:32},

            'X' : {style: 'round', text: 'X', bclass:'ps-x', x:80, y:30},
            'SQUARE' : {style: 'round', text: '[]', bclass:'ps-square', x:74, y:20},
            'CIRCLE' : {style: 'round', text: 'O', bclass:'ps-circle', x:86, y:20},
            'TRIANGLE' : {style: 'round', text: '^', bclass:'ps-triangle', x:80, y:10},

            lBumper : {style: 'bumper', text: 'L1', bclass:'ps-bumper', face:'top', x:25, y:70},
            rBumper : {style: 'bumper', text: 'R1', bclass:'ps-bumper', face:'top', x:75, y:70},

            lStickClick : {style: 'stick_click', target: 'lStick', x:30, y:45},
            rStickClick : {style: 'stick_click', target: 'rStick', x:70, y:45},

            lTrigger : {style: 'trigger', text:'L2', bclass:'ps-trigger', face:'top', x:25, y:20},
            rTrigger : {style: 'trigger', text:'R2', bclass:'ps-trigger', face:'top', x:75, y:20}
        },
        axis_dual : {
            lStick : {style: 'axis', x:30, y:45},
            rStick : {style: 'axis', x:70, y:45}
        }
    };

    inpoot.gamepads['Logitech F310'] = {
        displayName: 'Logitech F310 Controller',
        idMatches : [
            ['46d', 'c21d'],
            ['46d', 'c21e'],
            ['46d', 'c216']
        ],
        button : {

        }
    };

}(inpoot));