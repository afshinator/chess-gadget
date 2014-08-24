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
        this.ui.moveEvent(oldPos, newPos);
        console.log("*** onChange():  editable:" + this.editable + "  Old position: " + this.oldPos +  "  New position: " + this.newPos  );
        // this.save();
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
      this.ui.init( this );                               // initialize the UI component
      
      this.exerciseCreated = false;  
      this.recording = [];

      if ( this.config.exerciseType !== undefined ) {     // this.config contains authors persisted exercise info
        this.exerciseType = this.config.exerciseType;
        this.exerciseCreated = true;
        this.recording = this.config.recording;
        // TODO: now build the auxillary controls based on exerciseType
        this.ui.buildDisplay();
      }
      else {                                              // No exercise info found in config;
        this.ui.promptForExerciseType();            

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
          this.ui.setMode( this.editable );
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


  // TODO: add auxillary UI controls
  _.extend(Proto, {
      ui: function() {
        var el = {},            // will cache ui element selections
          memo = {
            recordingStarted : false,
            recordingFinished: false,
            isDeleting : false
          },
          me = null;            // 'this' context of main object

        init = function( thisPointer ) {
          me = thisPointer;                      

          el.$auxArea = $('#auxArea');
          el.$sections = [];
          for (var i=0; i < 3; i++) {                                       
            el.$sections[i] = el.$auxArea.find( '#section' + i );
          }
          el.$commentEntry = el.$sections[2].find( '#commentEntry' );
        },


        promptForExerciseType = function() {
          el.$auxArea.find( 'input:radio[name="exType"]' ).change( function() {
            me.exerciseType = $(this).val();
            // me.save( { exerciseType: me.exerciseType } );   // TODO: maybe dont persist this yet, wait until exercise is completed
            $(this).off();
            el.$sections[1].find('#exerciseTypeChoices').remove();
            buildDisplay();
          });
        },


        makeButton = function( $el, fn ) {                  // Make a button out of ui element
          $el.on('mouseover mouseout click', function(e) {
            if ( e.type === 'mouseover' ) {
              $(this).addClass('shadow1');
            } 
            else if ( e.type === 'mouseout' ) {
              $(this).removeClass('shadow1');
            }
            else if ( e.type === 'click' ) {
              fn( $(this) );           // invoke passed in handler, and pass it jquery ref to button
            }
          });
        },


        // callback for snapshot button, excercise 1
        takeASnapshot = function() {    // callback for pressing the camera button in Snapshot exercise
          me.recording.push( { pos: me.newPos, comment: el.$commentEntry.val() } );
          me.save( { exerciseType: me.exerciseType, recording: me.recording } );
          me.exerciseCreated = true;

          el.$sections[0].find( '.exercise1' ).off().css( 'display', 'none' );
          el.$commentEntry.css( 'display', 'none' );
          el.$sections[1].empty().append( '<h4>FEN Notation:</h4><p>' + me.newPos + '</p>' );
          el.$sections[2].append('<div><p><strong>Snapshot done.</strong></p><p>' + me.recording[0].comment + '</p></div>');
        },


        recordSequence = function(button) {
          if ( ! memo.recordingStarted ) {
            button.off().addClass('animate1');   // turn off catching these events, add class to indicate recording started
            memo.recordingStarted = true;

            me.recording.push( { pos: me.newPos, comment: el.$commentEntry.val(), delta: 'start' } );  // save current position as starting position
            el.$sections[0].find( '#pic4' ).off().css( 'display', 'none' );   // hide reset button
            el.$sections[0].find( '#pic5' ).off().css( 'display', 'none' );   // hide clear button
            el.$commentEntry.val('');            // empty out to enable next comment            
            el.$sections[1].empty().append( '<p id="movements"><span id="lastRecorded">0.<em>start</em></span></p>');

            // Setup handler for erase button
            makeButton( el.$sections[0].find( '#pic3' ), function() {
              var $section = el.$sections[1],
                html;

              if ( memo.recordingStarted && !memo.recordingFinished && me.recording.length > 1 ) {
                memo.isDeleting = true;
                me.recording.pop();
                me.board.position( me.recording[ me.recording.length - 1 ].pos );
                $section.find('.move').last().empty(); 
                // html = $section.find('#movements').html();

                // $section.empty().append( ) ;
                me.save( { recording: me.recording } );
              }
            });

            // Setup handler for next click to stop the recording
            button.one('click', function() {     // next click stops the recording
              button.removeClass('animate1');
              el.$sections[0].find( '#pic3' ).off().fadeOut();
              me.save( { exerciseType: me.exerciseType, recording: me.recording } );
              me.exerciseCreated = true;
              memo.recordingFinished = true;
            });
          }

        },


        buildDisplay = function() {             // TODO: make dry
          switch ( me.exerciseType ) {
            case 'Snapshot':
              el.$sections[0].find( '.exercise1' ).css( 'display', 'inline-block' );  // show top row buttons
              el.$sections[1].addClass( 'bordered' );
              el.$commentEntry.css( 'display', 'block' );                             // show comment entry textarea

              makeButton( el.$sections[0].find('#pic1'), takeASnapshot );
              makeButton( el.$sections[0].find('#pic4'), function(){ me.board.start(true); } ); // reset all the board pieces
              makeButton( el.$sections[0].find('#pic5'), function(){ me.board.clear(true); } ); // clear the board entirely
              break;

            case 'Sequence':
              el.$sections[0].find( '.exercise2' ).css( 'display', 'inline-block' );
              el.$sections[1].addClass( 'bordered' );
              el.$commentEntry.css( 'display', 'block' );
              el.$commentEntry.attr("placeholder", "Add optional comment for this scene.");

              makeButton( el.$sections[0].find('#pic2'), recordSequence );
              // makeButton( el.$sections[0].find('#pic3'),  );              
              makeButton( el.$sections[0].find('#pic4'), function(){ me.board.start(true); } ); // reset all the board pieces
              makeButton( el.$sections[0].find('#pic5'), function(){ me.board.clear(true); } ); // clear the board entirely
              break;

            default:
              break;

          }

        },


        authorLearnerToggle = function( isAuthorMode ) {
          var $tmp;

          // Case where no prerecorded exercise and author has yet to choose which one
          if ( me.exerciseType === undefined ) {
            $tmp = el.$sections[1].find( '#exerciseTypeChoices' );
            if ( isAuthorMode ) {
              $tmp.css( 'display', 'inline' );
            } else {
              $tmp.css( 'display', 'none' );
            }
            return;   
          }
          

          if ( isAuthorMode ) {     // --> Author mode
            if ( me.exerciseCreated ) {
              if ( me.exerciseType === 'Snapshot' ) {
                // el.$sections[2].empty().append('<p id="comment">' + me.recording[0].comment + '</p><div class="center"><img id="showSnap" src="vs-chess/img/pic4.png" height="70px" width="70px"><p></div>');
              }
            }
            else {  //  exercise not yet created
              el.$sections[0].css( 'visibility', 'visible' );
              el.$sections[2].css( 'visibility', 'visible' );
            }
          }
          else {                    // --> Learner mode
            el.$sections[0].css( 'visibility', 'hidden' );
            if ( me.exerciseCreated ) {
              if ( me.exerciseType === 'Snapshot' ) {
                el.$sections[2].empty().append('<p id="comment">' + me.recording[0].comment + '</p><div class="center"><img id="showSnap" src="vs-chess/img/pic4.png" height="70px" width="70px"></div>');
                makeButton( el.$sections[2].find('#showSnap'), function() {
                  me.board.position( me.recording[0].pos );
                  el.$sections[1].empty().append( '<h4>FEN Notation:</h4><p>' + me.recording[0].pos + '</p>' );
                });
              }
              if ( me.exerciseType === 'Sequence' ) {
                el.$sections[2].empty(); 
                el.$sections[2].append('<div class="center"><img id="goLeft" src="vs-chess/img/left.jpg" height="70px" width="70px"><img id="goRight" src="vs-chess/img/right.jpg" height="70px" width="70px"></div>');
                // TODO: handlers for left/right buttons
              }
            }
            else { //  exercise not yet created
              el.$sections[2].css( 'visibility', 'hidden' );
            }
          }

        },


        objectDelta = function ( a, b ) {
          var result = {};
          for (var i in b) {
            if ( a[i] !== b[i] ) {
              result[i] = b[i];
            }
          }
          return JSON.stringify(result).replace(/[^\w\s]/gi, '');
        },


        generateDeltaList = function( oldPos, newPos ) {
          var i, 
            moves = '<p id="movements"><span id="move0">0.<em>start</em></span>',
            moveDetail;

            moveDetail = objectDelta( oldPos, newPos );

            for ( i = 1; i < me.recording.length; i++ ) {
              moves += ( '   <span class="move move' + i + ' ' );
              if ( i === me.recording.length - 1 ) {
                moves += ( 'highlight1">    ' + i + '.' + moveDetail );
              } else {
                moves += ( '">    ' + i + '.' + me.recording[i].delta );
              }
              moves += '</span>';
            }
            moves += '</p>';

            return moves;
        },

        moveEvent = function( oldPos, newPos ) {

          // For snapshots, after its been recorded
          if ( me.exerciseType === 'Snapshot' ) {
            el.$sections[1].empty().append( '<h4>FEN Notation:</h4><p>' + me.newPos + '</p>' );
          }

          // For sequence, during the recording phase
          if ( memo.recordingStarted && !memo.recordingFinished && !memo.isDeleting) {
            // console.log('___ old: ' + JSON.stringify(oldPos) );
            // console.log('___ new: ' + JSON.stringify(newPos) );
console.log( "============= move event: "  );
            me.recording.push({ pos: me.newPos,                               // Record the movement for the sequence
                                comment: el.$commentEntry.val(), 
                                delta : objectDelta( oldPos, newPos )
                              });
            el.$commentEntry.val('');            // empty out to enable next comment            

            el.$sections[1].empty().append( generateDeltaList( oldPos, newPos ) );
          }
        };

        return {
          el: el,
          init: init,
          promptForExerciseType: promptForExerciseType,
          buildDisplay: buildDisplay,
          moveEvent: moveEvent,
          setMode : authorLearnerToggle
        };
      }()
  });


  //add some common methods
  _.extend(Proto, BaseCompMethods);

  document.registerElement('vs-chess', {
    prototype: Proto
  });

}());
