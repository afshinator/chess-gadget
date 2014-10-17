#Chess-gadget

## Basic functions
- Authors can setup the chess board with arbitrary configurations
- Authors can choose to record one of three exercise types below that can be played back by learners
- Authors can take a **snapshot** of a configuration and label that snapshot with a comment
- Authors can records a **sequence** of board movements, each frame can have a comment
- Authors can record a one move sequence as a **challenge** to be taken by learners
- Learners can view the chess board, move pieces
- Learners can play a prerecorded sequence
- Learners can take a prerecorded challenge

## Install
```
bower install
versal preview
```
Note: bower install automatically runs the following command in postinstall hook
```
cd vs-chess && npm install && bower install && grunt && cd ..
```

## Tech details
- The gadget consists of a custom element with some helper functions
- The ```<vs-chess></vs-chess>``` custom element implements embedding the board from chessboard.js
- The gadget.js helps communicating between the ```<vs-chess></vs-chess>``` custom element and the Versal platform
- The main functionality for Learners/Viewers is in **vs-chess/scripts/compo.js**, it should probably be broken out into different files.

## Versal platform details - To push to production
- Need to reduce the number of HTTP requests by running ```grunt``` which runs ```vulcanize```. Vulcanize concatenates a set of Web Components into one file.
- Step one, run
```
cd vs-chess && grunt
```
- Step two, inside index.html, import the ```<vs-chess></vs-chess>``` element from vs-chess/dist/vs-chess.html instead of vs-chess/vs-chess.html

## Note
- The [original port of chessboard.js by Versal](https://github.com/Versal/chess-gadget)
- More information about [custom elements](http://webcomponents.org/)

