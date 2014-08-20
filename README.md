#Chess-gadget

### Authors can setup the chess board with arbitrary configurations and learners can view the chess board.

### Install
```
bower install
versal preview
```
Note: bower install automatically runs the following command in postinstall hook
```
cd vs-chess && npm install && bower install && grunt && cd ..
```

### To develop
```
versal preview
```

### The gadget structure
- The gadget consists of a custom element with some helper functions
- The ```<vs-chess></vs-chess>``` custom element implements most functionalities for the gadget
- The gadget.js helps communicating between the ```<vs-chess></vs-chess>``` custom element and the Versal platform
- To add more functionalities, start with vs-chess/scripts/compo.js

### To push to production
- Need to reduce the number of HTTP requests by running ```grunt``` which runs ```vulcanize```. Vulcanize concatenates a set of Web Components into one file.
- Step one, run
```
cd vs-chess && grunt
```
- Step two, inside index.html, import the ```<vs-chess></vs-chess>``` element from vs-chess/dist/vs-chess.html instead of vs-chess/vs-chess.html

### Note
- More information about [custom elements](http://webcomponents.org/)
