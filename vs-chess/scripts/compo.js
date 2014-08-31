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

    detachedCallback: function(){     // when is this ever called?
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


    toggleBoard: function(flag){
      // Handler for catching chessboard moves
      var onChange = function(oldPos, newPos) {
        this.oldPos = ChessBoard.objToFen(oldPos);
        this.newPos = ChessBoard.objToFen(newPos);
        this.ui.moveEvent(oldPos, newPos);
// console.log("*** onChange():  editable:" + this.editable + "  Old position: " + this.oldPos +  "  New position: " + this.newPos  );
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


    reset:function() {
      this.exerciseType = undefined;
      this.exerciseCreated = false;      
      this.recording = [];
    },


    // Run at gadget startup, and also if browser reload happens
    init: function() {
      this.ui.init( this );                               // initialize the UI component
      
      this.reset();

      // this.config contains authors persisted exercise info
      if ( this.config.exerciseType !== undefined && this.config.exerciseType !== null ) {
        this.exerciseType = this.config.exerciseType;
        this.exerciseCreated = true;
        this.recording = this.config.recording;
        
        this.ui.buildDisplay();                           // Build the auxillary controls based on exerciseType
      }
      else {  // No exercise info found in config
        this.ui.promptForExerciseType();
      }
    },


    // Entry point for gadget and UI widgets functionality - 'data-config' is received upon startup
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
          // return !_.isEqual( oldV.position, newV.position );          
          return ! ( oldV.position ===  newV.position );          // TODO: _.isEqual was necessary for comparing position objects, but not for strings
        }
      }

// console.log('<---- attrName : ' + attrName + '--- this.editable: ' + this.editable + ' --- pieceMove: ' + pieceMoved() );
// console.log('--old ' + oldVal );  
// console.log('--new ' + newVal );
// console.log('------> this.config: ' + JSON.stringify(this.config) );
// console.log('+-----> this.firstTime : ' + this.firstTime  );

      // If this is the first time this handler fn is called (at gadget startup),
      // then initialize the auxially UI stuff.   firstTime = true when reset button was used
      if ( this.firstTime === undefined ) {            
        this.firstTime = false;  
        this.init();                                  // All other initialization, including asking about exercise type
      }

      switch (attrName) {
        case 'editable':                // Event indicates toggle between Author/Learner mode
          this.toggleBoard(this.editable);
          this.ui.setMode( this.editable );
          break;

        case 'data-config':             // Event indicates prop-sheet changes OR chessboard move
          if ( ! pieceMoved() ) {       // If its not a piece movement, its a prop sheet change
            this.toggleBoard(this.editable);      // TODO: parameter not used at this point
          }
          break;

        default:
          break;
      }
    }

  });


  // Auxillary UI controls for the chessboard - to create Snapshots, Sequence recording, or a Challenge
  _.extend(Proto, {
      ui: function() {
        var el = {},            // will cache ui element selections
          memo = {
            recordingStarted : false,
            recordingFinished: false,
            isDeleting : false
          },
          me = null;            // 'this' context of main object

        reset = function() {
          memo.recordingStarted = false;
          memo.recordingFinished = false;
        },

        init = function( thisPointer ) {
          if ( me === null ) { 
            me = thisPointer;                      

            el.$auxArea = $('#auxArea');
            el.$sections = [];
            for (var i=0; i < 5; i++) {                                       
              el.$sections[i] = el.$auxArea.find( '#section' + i );
            }
            el.$status = $('#statusMsg').hide();
            el.$commentEntry = el.$sections[2].find( '#commentEntry' );
          }
          reset();
        },


        // Popup a message after finishing a snapshot or sequence
        statusMessage = function(str, bCenter) {
          el.$status.find('.msg').remove();
          el.$status.css('display', 'block')
            .append( '<h2 class="msg">' + str + '</h2>' )
            .one( 'click', function() {
              $(this).fadeOut('150');
            });
        },


        promptForExerciseType = function() {
          var html = 
            '<div id="exerciseTypeChoices" class="author-only"> \
              <legend>Choose exercise type to create:</legend> \
              <input type="radio" name="exType" value="Snapshot" /> Snapshot<br/> \
              <input type="radio" name="exType" value="Sequence" /> Sequence<br/> \
              <input type="radio" name="exType" value="Challenge" disabled="disabled"/> Challenge<br/> \
            </div>';

          el.$sections[1].append( html );

          el.$sections[1].find( 'input:radio[name="exType"]' ).change( function() {
            me.exerciseType = $(this).val();
            el.$sections[1].empty(); // why can't I $(this).remove() ?
            // Now we know what kind of exercise controls to display
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
              fn( $(this) );           // invoke passed in handler, and pass it jquery ref to element
            }
          });
        },


        // Callback for Snapshot button, excercise 1
        takeASnapshot = function() {    // callback for pressing the camera button in Snapshot exercise
          if ( me.exerciseCreated ) { // in case of a prevouisly recorded snapshot
            me.recording.pop();
          }
          me.recording.push( { pos: me.newPos || me.board.fen(), comment: el.$commentEntry.val().trim() } );
          me.save( { exerciseType: me.exerciseType, recording: me.recording } );
          me.exerciseCreated = true;

          el.$commentEntry.val('').attr("placeholder", "");
          statusMessage( 'Snapshot done.  Click camera again to capture new snapshot.', true );
          el.$sections[3].empty().append('<p class="comment">' + me.recording[0].comment + '</p>');
          el.$sections[0].find( '#pic1' )
            .hide()
            .fadeIn('250', function() {
              el.$sections[1]
                .empty()
                .append( '<h4>FEN Notation:</h4><p class="highlight1">' + (me.newPos || me.board.fen()) + '</p>' );
            });
        },


        // Callback for Sequence Record on/off button, excercise 2
        recordSequence = function(button) {     
          button.off().addClass('animate1');   // turn off catching these events, add class to indicate recording started

          if (  memo.recordingFinished ) {      // A previous recording exists
            me.exerciseCreated = false;
            el.$sections[0].find( '.arrow' )    // Turn off left/right buttons during recording
                  .removeClass( 'cursor1' ).addClass( 'faded1' ).off();
            el.$sections[3].find('.comment').remove();      // 
            el.$sections[1].find('.move').removeClass('highlight1');
            me.board.position( me.recording[ me.recording.length - 1 ].pos );
            el.$sections[1].find('.move').last().addClass('highlight1');
            // el.$sections[3].append( '<span class="comment">' + ( me.recording[frame].comment || " " ) + '</span>' );              
          } 
          else {            // Brand new recording
            me.recording.push({                  // save current position as starting position
                pos: me.newPos || me.board.fen(), 
                comment: el.$commentEntry.val().trim(), 
                delta: 'start' 
            });
            el.$sections[1].empty().append( '<p id="movements"><span id="lastRecorded">0.<em>start</em></span></p>');
          }

          memo.recordingStarted = true; 
          memo.recordingFinished = false;
          el.$sections[0].find( '#pic3' ).off().fadeIn();                   // show erase button
          el.$sections[0].find( '#pic4' ).off().css( 'display', 'none' );   // hide reset button
          el.$sections[0].find( '#pic5' ).off().css( 'display', 'none' );   // hide clear button
          el.$commentEntry.val('');            // empty out to enable next comment            


          // Handler for erase button, only active during recording
          makeButton( el.$sections[0].find( '#pic3' ), function() {
            var $section = el.$sections[1],
              html;

            if ( memo.recordingStarted && !memo.recordingFinished && me.recording.length > 1 ) {
              memo.isDeleting = true;
              me.recording.pop();
              me.board.position( me.recording[ me.recording.length - 1 ].pos );
              $section.find( '.move' ).last().remove();
              $section.find( '.move' ).last().addClass( 'highlight1' );

              me.save( { recording: me.recording } );
            }
          });

          // Handler for next click to stop the recording
          button.one( 'click', stopRecordingSequence );
        },


        // called after hittign recording button to stop, or switch to learner mode in the middle of recording
        stopRecordingSequence = function() {   
          var button = el.$sections[0].find('#pic2');

          button.off().removeClass('animate1');
          el.$sections[0].find( '#pic3' ).off().fadeOut();      // turn off erase button

          me.save( { exerciseType: me.exerciseType, recording: me.recording } );
          me.exerciseCreated = true;
          memo.recordingFinished = true;
          if ( me.editable ) {    
            statusMessage("Recording sequence done. Click recorder button again to add or delete frames.", true ); 
          }
          makeButton( button, recordSequence );    // setup to enable restarting recording

          enableArrowButtons();
          enableClickOnFrame();
        },


        // Make arrow buttons clickable for Author & Leaner; called after a recording is finished
        enableArrowButtons = function() {
          el.$sections[0].find( '.pic' ).removeClass( 'faded1' );   // show arrow buttons
          el.$sections[0].find( '.arrow' )        // TODO: refactor. make dry, this shares a lot of code with the handler below
            .addClass( 'cursor1' )
            .on( 'click', function(e) {
              var frame = el.$sections[1].find('.highlight1').text().trim();

              el.$sections[3].find('.comment').remove();
              frame = ( frame.slice(0, frame.indexOf('.')) ) * 1;     // extract frame #, cast to number           
              if ( $(this).context.id === 'goLeft' )  {
                if ( frame == 0 ) { return; }
                el.$sections[1].find('.highlight1').removeClass('highlight1').prev().addClass('highlight1');
                frame--;
              }
              else {            // go Right 
                if ( frame == me.recording.length - 1 ) { return; }
                el.$sections[1].find('.highlight1').removeClass('highlight1').next().addClass('highlight1');
                frame++;
              }
              me.board.position( me.recording[frame].pos );
              el.$sections[3].append( '<span class="comment">' + ( me.recording[frame].comment || " " ) + '</span>' );
            });
        },


        // Make each frame in sequence recording clickable for Author & Leaner; called after a recording is finished
        enableClickOnFrame = function() {
          el.$sections[1].find('.move')
            .addClass('cursor1')
            .on( 'click', function(e) {   // handler to allow jumping to any step in the recorded sequence
              var frame = $(e.target).text().trim();          // get text from the html for frame #

              el.$sections[3].find('.comment').remove();      // 
              el.$sections[1].find('.move').removeClass('highlight1');
              $(e.target).addClass('highlight1');
              frame = frame.slice(0, frame.indexOf('.'));     // extract frame #
              me.board.position( me.recording[frame].pos );
              el.$sections[3].append( '<span class="comment">' + ( me.recording[frame].comment || " " ) + '</span>' );
            });
        },


        // To restart all over - the button on the bottom right in Author mode
        makeResetButton = function( $el ) {        
          makeButton( $el.show(), function(e) {  // reset gadget button
              e.fadeOut(50, function() {
                e.fadeIn(50, function() {
                  if ( confirm('Confirm that you want to reset the widget and forget your data?') ) {
                    console.log( '!!! Resetting Chess gadget !!!' );
                    el.$sections[0].find( '.exercise' ).off().css( 'display', 'none' );
                    el.$sections[0].find('#pic2').removeClass('animate1');  // in case was in the middle of recording
                    el.$sections[1].removeClass( 'bordered' ).empty();
                    el.$sections[3].empty();
                    el.$commentEntry.css( 'display', 'none' );
                    el.$status.hide();
                    me.reset();
                    me.firstTime = true;
                    reset();
                    // me.save( { exerciseType: me.exerciseType, recording: me.recording } );
                    me.save( { exerciseType: undefined, recording: undefined } );
                    me.board.position( 'start' );
                    e.off();
                    e.hide();
                    promptForExerciseType();
                  }
                });
              });
            });
        },


        // At startup time, display ui components based on which exercise type was chosen
        buildDisplay = function() {
          el.$sections[1].addClass( 'bordered' );
          el.$commentEntry.css( 'display', 'block' );            // show comment entry textarea
// console.log('***** me.exerciseType ' + me.exerciseType );
// console.log('***** me.exerciseCreated ' + me.exerciseCreated );
// console.log('***** memo.recordingStarted ' + memo.recordingStarted);
// console.log('***** memo.recordingFinished ' + memo.recordingFinished);
// console.log('***** me.firstTime ' + me.firstTime );
// console.log('***** me.editable ' + me.editable);
          makeButton( el.$sections[0].find( '#pic4' ), function(){ me.board.start(true); } ); // reset all the board pieces
          makeButton( el.$sections[0].find( '#pic5' ), function(){ me.board.clear(true); } ); // clear the board entirely
          makeResetButton( el.$sections[4] );     // reset the whole gadget button

          switch ( me.exerciseType ) {
            case 'Snapshot':
              el.$sections[0].find( '.exercise1' ).css( 'display', 'inline-block' );  // show top row buttons for this exercise          
              makeButton( el.$sections[0].find( '#pic1' ), takeASnapshot );
              break;

            case 'Sequence':
              el.$sections[0].find( '.exercise2' ).css( 'display', 'inline-block' );
              el.$commentEntry.attr( 'placeholder', 'Add optional comment for the next move.' );
              el.$sections[0].find( '#pic3' ).hide(); 
              makeButton( el.$sections[0].find( '#pic2' ), recordSequence );
              break;

            default:
              break;
          }

          // Case where after recording, a browser refresh happened
          if ( me.exerciseCreated === true && me.exerciseType === 'Sequence' ) { 
            memo.recordingFinished = true;
// console.log('Verify that this only comes up after recording, and browser refresh.');
            el.$sections[1]
              .empty()
              .append( generateDeltaList( me.recording[ me.recording.length - 1 ].delta ) );
            enableArrowButtons();
            enableClickOnFrame();
          }

        },


        // Callback for player mode switches between Author and Learner modes,
        // gadget receives the event at startup time once as well. 
        authorLearnerToggle = function( isAuthorMode ) {
          if ( isAuthorMode ) {           // --> Author mode
            el.$auxArea.find('.author-only').css( 'visibility', 'visible' );

            if ( me.exerciseType === undefined ) return;

            el.$sections[2].css( 'display', 'block' );

            if ( me.exerciseCreated ) {
              if ( me.exerciseType === 'Snapshot' ) {
                el.$sections[3].find('#showSnap').off().remove();
              }
              if ( me.exerciseType === 'Sequence' ) {
                // TODO : nothing yet
              }
            }
            else {  //  exercise not yet created
              el.$sections[2].css( 'display', 'block' );
            }
          }
          else {                          // --> Learner mode
            el.$auxArea.find('.author-only').css( 'visibility', 'hidden' );

            if ( me.exerciseType === undefined ) return;

            el.$sections[2].css( 'display', 'none' );

            if ( me.exerciseCreated ) {
              el.$status.hide();
              if ( me.exerciseType === 'Snapshot' ) {             // Snapshot ------------------
                // el.$sections[3].empty().append('<p class="comment">' + me.recording[0].comment + '</p><div class="center"><img id="showSnap" src="vs-chess/img/pic4.png" height="70px" width="70px"></div>');
                el.$sections[3].append( '<div class="center"><img id="showSnap" src="vs-chess/img/pic4.png" height="70px" width="70px"></div>');
                makeButton( el.$sections[3].find('#showSnap'), function() {
                  me.board.position( me.recording[0].pos );
                  el.$sections[1].empty().append( '<h4>FEN Notation:</h4><p class="highlight1">' + me.recording[0].pos + '</p>' );
                  el.$sections[3].find( '.comment' ).remove();
                  el.$sections[3].prepend( '<p class="comment">' + me.recording[0].comment + '</p>' );
                });
              }
              if ( me.exerciseType === 'Sequence' ) {             // Sequence ------------------
                el.$sections[3].empty();
              }
            }
            else { //  Learner mode, exercise not yet created
              if ( me.exerciseType === 'Sequence' ) {
                if ( memo.recordingStarted ) {
                  stopRecordingSequence();      // pretend stop button was hit.
                  authorLearnerToggle( isAuthorMode );
                }
              }
            }
          }

        },


        // simple object compare, return key/val in b thats not in a
        objectDelta = function ( a, b ) {     
          var result = {};
          for (var i in b) {
            if ( a[i] !== b[i] ) {
              result[i] = b[i];
            }
          }
          return JSON.stringify(result).replace(/[^\w\s]/gi, '');   // turn into a string, take out non-alphanum characters
        },


        // put together html string containing the delta's (changes) between each recorded move
        // called mainly by moveEvent() but also after browser refresh prompts re-displaying recorded sequence
        generateDeltaList = function( moveDetail ) {
          var i, 
            moves = '<p id="movements"><span id="move0" class="move">0.start</span>';

            for ( i = 1; i < me.recording.length; i++ ) {
              moves += ( '   <span id="move' + i + '" class="move ' );
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


        // Called upon every movement of a piece on the board
        moveEvent = function( oldPos, newPos ) {
          // For snapshots,
          if ( me.exerciseType === 'Snapshot' ) {
            el.$sections[3].find('.comment').remove();
            el.$sections[1].empty().append( '<h4>FEN Notation:</h4><p>' + me.newPos + '</p>' );
            return;
          }

          // For sequence, during recording 
          var lastDelta;
          if ( memo.recordingStarted && !memo.recordingFinished && !memo.isDeleting) {
            lastDelta = objectDelta( oldPos, newPos );
            me.recording.push({ pos: me.newPos,                               // Record the movement for the sequence
                                comment: el.$commentEntry.val(), 
                                delta : lastDelta
                              });
            el.$commentEntry.val('');            // empty out to enable next comment            
            el.$sections[1].empty().append( generateDeltaList( lastDelta ) );
          }

          if ( memo.isDeleting ) memo.isDeleting = false;
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
