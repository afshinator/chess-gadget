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

    // always destory the current board
    // always create a new board that is either editable or read-only
    // based on the flag
    toggleBoard: function(flag){
      //this.config is undefined in attachedCallback for Chrome36
      var position = (this.config && this.config.position) || 'start';

      var cfg = {
        draggable: flag,
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
      switch (attrName) {
        case 'editable':
          this.toggleBoard(this.editable);
          this.toggleMouse(this.editable);
          break;
        case 'data-config':
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
