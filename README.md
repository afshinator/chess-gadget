chess-gadget

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

### Structure
- index.html and gadget.js set up the communication with the Versal platform
- ```<vs-chess></vs-chess>``` custom element implements most functionalities for the gadget
- vs-chess/scripts/compo.js is a good starting point for adding functionalities

### Need to run ```vulcanize``` if we want to prepare for production
- Instead of pointing to vs-chess/vs-chess.html in index.html
- Run
```
cd vs-chess && grunt
```
- Then point to vs-chess/dist/vs-chess.html in index.html
