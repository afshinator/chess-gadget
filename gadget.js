(function(){
  /* global _, $, VersalPlayerAPI */

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
    this.vi.setHeight(400);

    this.vi.setPropertySheetAttributes({
      memo: {
        title: 'Memo',
        type: 'Text'
      }
    });
  };

  //starting point of the gadget
  new Gadget();

})();
