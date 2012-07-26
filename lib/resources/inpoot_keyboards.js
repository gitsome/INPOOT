/*
* inpoot_keyboards.js
*/


(function (inpoot) {
    "use strict";

    /**
     * keyboards namespace
     * Stores keypad to keycode mapps
     * idMatches : strings that must be inside the gamepad ID to match the gamepad type.
     * this mapping will hopefully help with internationalization etc...
     * Thanks to those in #BBG for the tip to include this functionality
     */
    inpoot.keyboards = {};

    //the default keyboard
    inpoot.currentKeyboard = 'wasd';

    //a public way to set the default (can be done at anytime)
    inpoot.setCurrentKeyboard = function (newKeyboard) {
        inpoot.currentKeyboard = newKeyboard;
    };

    //return the current text value of the character code based on the current keyboard (used mostly internally)
    inpoot.getKeyboardMap = function (charCode) {
        return inpoot.keyboards[inpoot.currentKeyboard][charCode];
    };

    //standard wasd keyboard
    inpoot.keyboards['wasd'] = {
        8 : 'Backspace',
        9 : 'Tab',
        13 : 'Enter',
        16 : 'Shift',
        17 : 'Ctrl',
        18 : 'Alt',
        19 : 'Pause/Break',
        20 : 'Caps Lock',
        27 : 'Esc',
        32 : 'Spacebar',
        33 : 'Page Up',
        34 : 'Page Down',
        35 : 'End',
        36 : 'Home',
        37 : 'Arrow Left',
        38 : 'Arrow Up',
        39 : 'Arrow Right',
        40 : 'Arrow Down',
        45 : 'Insert',
        46 : 'Delete',
        48 : '0',
        49 : '1',
        50 : '2',
        51 : '3',
        52 : '4',
        53 : '5',
        54 : '6',
        55 : '7',
        56 : '8',
        57 : '9',
        189: '_-',
        187: '=+',
        186: ';:',
        59 : ';:',
        61 : '=+',
        65 : 'a',
        66 : 'b',
        67 : 'c',
        68 : 'd',
        69 : 'e',
        70 : 'f',
        71 : 'g',
        72 : 'h',
        73 : 'i',
        74 : 'j',
        75 : 'k',
        76 : 'l',
        77 : 'm',
        78 : 'n',
        79 : 'o',
        80 : 'p',
        81 : 'q',
        82 : 'r',
        83 : 's',
        84 : 't',
        85 : 'u',
        86 : 'v',
        87 : 'w',
        88 : 'x',
        89 : 'y',
        90 : 'z',
        91 : 'Windows',
        96 : '0 (Num Lock)',
        97 : '1 (Num Lock)',
        98 : '2 (Num Lock)',
        99 : '3 (Num Lock)',
        100 : '4 (Num Lock)',
        101 : '5 (Num Lock)',
        102 : '6 (Num Lock)',
        103 : '7 (Num Lock)',
        104 : '8 (Num Lock)',
        105 : '9 (Num Lock)',
        106 : '* (Num Lock)',
        107 : '+ (Num Lock)',
        109 : '- (Num Lock)',
        110 : '. (Num Lock)',
        111 : '/ (Num Lock)',
        112 : 'F1',
        113 : 'F2',
        114 : 'F3',
        115 : 'F4',
        116 : 'F5',
        117 : 'F6',
        118 : 'F7',
        119 : 'F8',
        120 : 'F9',
        121 : 'F10',
        122 : 'F11',
        124 : 'F12',
        144 : 'Num Lock',
        145 : 'Scroll Lock',
        182 : 'My Computer',
        183 : 'My Calculator',
        188 : ',<',
        190 : '.>',
        191 : '/?',
        192 : '`~',
        220 : '|',
        221 : ']}',
        222 : '\'"',
        219 : '[{'
    };

}(inpoot));