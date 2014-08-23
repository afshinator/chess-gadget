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

    save: function(){
      if(this.board) {
        this.trigger('vs-chess:change', {
          position: this.board.position()
        });
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
      var cfg, 
          position = (this.config && this.config.position) || 'start';    //this.config is undefined in detachedCallback for Chrome36

      cfg = {
        draggable: flag,
        showNotation: (this.config && this.config.showNotation !== undefined ) ? this.config.showNotation : false,
        // setting a default for sparePieces in versal.json breaks draggable: false !!
        sparePieces : (this.config && this.config.sparePieces !== undefined ) ? this.config.sparePieces : false,  
        orientation: (this.config  && (this.config.flipped === true) )  ? 'black' : 'white',
        dropOffBoard: (this.config && this.config.dropOffBoard === true ) ? 'trash' : 'snapback', 
        moveSpeed: 'slow',
        snapbackSpeed: 500,
        snapSpeed: 100,
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

    attributeChangedCallback: function(attrName, oldVal, newVal){
      function pieceMoved() {     // returns true if data-config event was a piece move (rather than prop sheet change)
        var oldV, newV;

        if ( oldVal === null && newVal === null ) {   // oldVal, newVal are null until a move is generated
          return false; 
        }
        else if ( oldVal === null && newVal.position === undefined ) { // A prop-sheet peek can cause this situation
          return false;
        } else {
          oldV = JSON.parse(oldVal);  newV = JSON.parse(newVal);
          if ( oldV.position === undefined && oldV.position === undefined ) return false;  
          return !_.isEqual( oldV.position, newV.position );
        }
      }

console.log('<-- attrName ' + attrName);
console.log('----- this.editable:' + this.editable );
// console.log('--old ' + oldVal );  
// console.log('--new ' + newVal );
console.log('-- pieceMoved ' + pieceMoved() );
console.log('----> this.config:' + JSON.stringify(this.config) );


      switch (attrName) {
        case 'editable':          // Event indicates toggle between Author/Learner mode
          this.toggleBoard(this.editable);
          this.toggleMouse(this.editable);
          break;
        case 'data-config':       // Event indicates prop-sheet changes OR chessboard move
          this.setBoardPosition(this.config.position);
          break;
        default:
          break;
      }
    }

  });

  //add some common methods
  _.extend(Proto, BaseCompMethods);

  document.registerElement('vs-chess', {
    prototype: Proto
  });

}());
