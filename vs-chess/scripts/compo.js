/* global $, _, BaseCompMethods, ChessBoard */

(function(){

  var _doc = (document._currentScript || document.currentScript).ownerDocument;
  var _template = _doc.querySelector('template#vs-chess');
  //todo
  //using id is a temporary solution for template polluting between elements

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
      this.trigger('vs-chess:change', {
        position: this.board.position()
      });
    },

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
      var position = this.config.position || 'start';

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

  //common methods and view methods
  _.extend(Proto, BaseCompMethods);

  document.registerElement('vs-chess', {
    prototype: Proto
  });

}());
