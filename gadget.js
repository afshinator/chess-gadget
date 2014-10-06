(function(){
  /* global _, $, VersalPlayerAPI */


  var propSheetControls = {
      showNotation: {
        title: 'Show board coordinates',
        type: 'Checkbox'
      },
      flipped: {
        title: 'Flip black/white orientation',
        type: 'Checkbox'
      }
    };

  var Gadget = function() {
    this.vi = new VersalPlayerAPI();
    this.addChildrenEvents();
    this.addConfigAndEditableEvents();
    this.setHeightAndPropertySheet();
    this.vi.startListening();
  };

  //events for children components
  Gadget.prototype.addChildrenEvents = function() {
    document.addEventListener('vs-chess:change', function(data){
      this.vi.setAttributes(data.detail);
    }.bind(this));

    document.addEventListener('vs-chess:addToPropSheet', function( obj ){
      _.extend( obj, propSheetControls );    
      this.vi.setPropertySheetAttributes( obj );
    }.bind(this));
  };

  Gadget.prototype.addConfigAndEditableEvents = function(){
    //data-config and editable
    var $vsChess = $('vs-chess');
    this.vi.on('attributesChanged', function(attrs){
      $vsChess.attr('data-config', JSON.stringify(attrs));
    }.bind(this));
    this.vi.on('editableChanged', function(data){
      $vsChess.attr('editable', JSON.stringify(data.editable));
    }.bind(this));
  };

  Gadget.prototype.setHeightAndPropertySheet = function() {
    this.vi.setHeight(470);

    this.vi.setPropertySheetAttributes( propSheetControls );
  };

  window.addEventListener('WebComponentsReady', function() {
    new Gadget();
  });  //starting point of the gadget

})();
