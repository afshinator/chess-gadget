/* global $, _, BaseCompMethods, ChessBoard */

(function(){

  var _doc = (document._currentScript || document.currentScript).ownerDocument;
  var _template = _doc.querySelector('template#vs-chess-template');

  // add some getters
  var Proto = Object.create(HTMLElement.prototype, BaseCompMethods.propertiesObject);

  //life cycle events
  _.extend(Proto, {
    createdCallback: function(){
      // console.log('createdCallback');
      this.innerHTML = _template.innerHTML;
      this.$el = $(this);
      this.lazySave = _.throttle(function(){
        this.save();
      }.bind(this), 500);
    },

    attachedCallback: function(){
      this.toggleBoard(false);
    },

    detachedCallback: function(){
      this.toggleMouse(false);
      if(this.board) {
        this.board.destroy();
      }
    },

    save: function(optionalObj){
      if(this.board) {
        if ( typeof optionalObj === "object" ) { 
          this.trigger('vs-chess:change', optionalObj );
        } else { 
          this.trigger('vs-chess:change', { position: this.newPos }); // this.board.position()
        }     
      }
    },

    // toggle listeners on 'mousemove'
    // when authoring, save constantly upon 'mousemove'
    toggleMouse: function(flag){
      if(flag) {
        this.$el.on('mousemove', function(){
          this.lazySave();
        }.bind(this));
      } else {
        this.$el.off('mousemove');
      }
    },


    toggleBoard: function(flag){
      // Handler for catching chessboard moves
      var onChange = function(oldPos, newPos) {
        this.oldPos = ChessBoard.objToFen(oldPos);
        this.newPos = ChessBoard.objToFen(newPos);
        console.log("**onChange()   editable:" + this.editable + "   Old position: " + this.oldPos +  "      New position: " + this.newPos  );
        this.save();
      };

      var cfg, 
          // position = (this.config && this.config.position) || 'start';    //this.config is undefined in detachedCallback for Chrome36
          position = this.newPos || 'start';    //this.config is undefined in detachedCallback for Chrome36

      cfg = {
        draggable: false,
        showNotation: (this.config && this.config.showNotation !== undefined ) ? this.config.showNotation : false,
        // setting a default for sparePieces in versal.json breaks draggable: false !!
        sparePieces : (this.config && this.config.sparePieces !== undefined ) ? this.config.sparePieces : false,  
        orientation: (this.config  && (this.config.flipped === true) )  ? 'black' : 'white',
        dropOffBoard: (this.config && this.config.dropOffBoard === true ) ? 'trash' : 'snapback', 
        moveSpeed: 'slow',
        snapbackSpeed: 500,
        snapSpeed: 100,
        onChange: onChange.bind(this),
        position: position
      };

      if(this.board) {
        this.board.destroy();
      }

      this.board = new ChessBoard('board1', cfg);
    },

    setBoardPosition: function(position){
      if(this.board) {
        this.board.position(position);
      }
    },


    init: function() {
      // TODO: initialize the UI component
      
      this.exerciseCreated = false;  
      this.recording = [];

      if ( this.config.exerciseType !== undefined ) {     // this.config contains authors persisted exercise info
        this.exerciseType = this.config.exerciseType;
        this.exerciseCreated = true;
        this.recording = this.config.recording;
        // TODO: now build the auxillary controls based on exerciseType
      }
      else {                                              // No exercise info found in config;
        // TODO: askAboutExerciseOptions() in UI Component to set exerciseType

      }
    },


    attributeChangedCallback: function(attrName, oldVal, newVal){
      function pieceMoved() {     // returns true if data-config event was a piece move (rather than prop sheet change)
        var oldV, newV;
        if ( attrName === 'editable' ) return false;

        if ( oldVal === null && newVal === null ) {   // oldVal, newVal are null until a move is generated
          return false; 
        }
        else if ( oldVal === null && newVal.position === undefined ) { // A prop-sheet peek can cause this situation
          return false;
        } else {
          oldV = JSON.parse(oldVal);  newV = JSON.parse(newVal);
          if ( oldV.position === undefined && newV.position === undefined ) return false;  
          return !_.isEqual( oldV.position, newV.position );          // TODO: _.isEqual was necessary for comparing position objects, but not for fen strings
        }
      }

console.log('<---- attrName : ' + attrName + '--- this.editable: ' + this.editable + ' --- pieceMove: ' + pieceMoved() );
// console.log('--old ' + oldVal );  
// console.log('--new ' + newVal );
console.log('------> this.config: ' + JSON.stringify(this.config) );

      // Upon gadget startup, this.config doesn't get persisted gadget options right away

      this.memo = this.memo || { firstTime : true };      // todo: it'll break if used again in any other method

      if ( this.memo['firstTime'] === true ) {        // First time this function is called, 
      //  this.toggleBoard(this.editable);            // Instantiate the board object before init() is called
        this.init();                                  // All other initialization, including asking about exercise type
        this.memo['firstTime'] = false;               // So this doesn't run again.
      }

      switch (attrName) {
        case 'editable':                // Event indicates toggle between Author/Learner mode
          this.toggleBoard(this.editable);
         //  this.toggleMouse(this.editable);
          break;
        case 'data-config':             // Event indicates prop-sheet changes OR chessboard move
          // this.setBoardPosition(this.config.position);
          if ( ! pieceMoved() ) {       // If its not a piece movement, its a prop sheet change
            this.toggleBoard(this.editable);      // TODO: parameter not used at this point
          }
          break;
        default:
          break;
      }
    }

  });

  // add auxillary UI controls
  _.extend(Proto, {
      ui: function() {
            console.log('TODO: automatically cache ui selections, present interface for rest ');
      }()
  });


  //add some common methods
  _.extend(Proto, BaseCompMethods);

  document.registerElement('vs-chess', {
    prototype: Proto
  });

}());
