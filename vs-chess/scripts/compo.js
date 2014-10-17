/* global $, _, BaseCompMethods, ChessBoard */

(function(){

"use strict";

   var _doc = (document._currentScript || document.currentScript).ownerDocument;
   var _template = _doc.querySelector('template#vs-chess-template');

   // add some getters
   var Proto = Object.create(HTMLElement.prototype, BaseCompMethods.propertiesObject);


  /* life cycle events
   */
  _.extend(Proto, {
      /* State saved on this object :
         General Versal gadget stuff:
            this.editable  -  Set by vs-player; true : author mode,  false : learner mode
            this.config    -  Set by vs-player; the persisted gadget data

         State specific to this Chess Gadget:
            this.state     - All sorts of good stuff to enable this gadgets functionality, see reset().
      */

      init: function() {
         this.reset();

         this.board.init( this );
         this.view.init( this );                        // initialize the UI component

         // this.config contains authors persisted exercise info from Versal platform
         if ( this.config.exerciseType !== undefined && this.config.exerciseType !== null ) {
            this.state.exerciseType = this.config.exerciseType;
            this.state.exerciseCreated = true;
            this.state.recording = this.config.recording;

            this.view.buildDisplay( this.state.exerciseType );            // Build the auxillary controls based on exerciseType
         }
         else {  // No exercise info found in config
            this.view.promptForExerciseType();
         }
      },

      reset : function () {
         this.state.exerciseType = undefined;
         this.state.exerciseCreated = false;

         this.state.recordingStarted = false;
         this.state.recordingFinished = false;
         this.state.challengeStarted = false;
         this.state.challengeFinished = false;
         this.state.isDeleting = false;
         this.state.recording = [];         
      },

      createdCallback: function(){
         this.innerHTML = _template.innerHTML;
         this.$el = $(this);
      },

      attachedCallback: function(){
      },

      detachedCallback: function(){
         this.board.destroy();
      },

      persistToVSPlayer: function( obj ) {
         this.trigger('vs-chess:change', obj );
      },

      addToPropertySheet: function( obj ) {
         this.trigger('vs-chess:addToPropSheet', obj );
      },

      toggleAuthorLearner: function( editable ) {
         this.view.toggleAuthorLearner( editable );
      },

      attributeChangedCallback: function(attrName, oldVal, newVal){
         // Returns true if data-config event was a piece move (rather than prop sheet change)
         function pieceMoved() {     
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
               return ! ( oldV.position ===  newV.position );
            }
         }


         // The first time this handler fn is called (at gadget startup),
         // initialize the auxillary UI stuff.   
         if ( this.state === undefined ) {  // this.state is not declared above, so will be undefined
            this.state = { };
            this.init();   
         }

         switch (attrName) {
            case 'editable':                // Event indicates toggle between Author/Learner mode
               this.board.refresh(); 
               this.toggleAuthorLearner( this.editable );
               break;

            case 'data-config':             // Event indicates prop-sheet changes OR chessboard move
               if ( ! pieceMoved() ) {       // If its not a piece movement, its a prop sheet change
                 this.board.refresh(); 
               }
               break;

            default:
               break;
         }
      }  // end attributeChangedCallback()

   });



   _.extend(Proto, {
      /* The board holds and abstracts chessboard.js ; TODO: chess.js logic will go in here also
       */
      board: function() {
         var me = null,
            _theBoard = null,
            _oldPos = null,
            _newPos = null;

         var init = function ( thisPointer ) {
               if ( me === null ) {
                  me = thisPointer;                      
               }
            },

         // Called upon author/leaner change, or prop-sheet change
         refresh = function ( allowMovement ) {
            // Handler for catching chessboard moves
            var onChange = function(oldPos, newPos) {
                  _oldPos = oldPos;
                  _newPos = newPos;

                  // Tell the view about the chess piece movement; it will trigger recordings...
                  me.view.chessPieceMoveEvent( oldPos, newPos );                     
               };

            var cfg,
               position = _newPos || 'start';    //this.config is undefined in detachedCallback for Chrome36

            cfg = {
               draggable: ( allowMovement === undefined ) ? true : allowMovement,
               showNotation: (me.config && me.config.showNotation !== undefined ) ? me.config.showNotation : false,
               // setting a default for sparePieces in versal.json breaks draggable: false !! (?)
               sparePieces : true, 
               orientation: (me.config  && (me.config.flipped === true) )  ? 'black' : 'white',
               dropOffBoard: 'trash', 
               moveSpeed: 'slow',
               snapbackSpeed: 500,
               snapSpeed: 100,
               onChange: onChange,
               position: position
            };

            destroy();
            _theBoard = new ChessBoard('board1', cfg);
         },

         destroy = function() { if ( _theBoard ) { _theBoard.destroy(); }  },
         resetToStart = function() { _theBoard.start(true); },
         clearAllPieces = function() { _theBoard.clear(true); },
         setPosition = function( pos ) {
            if ( _theBoard === null ) { refresh(); }
            _theBoard.position( pos );
         },       
         isSnapshotState = function() {
            if ( _theBoard === null ) return false;
            return ( me.state.recording[0].pos === ChessBoard.objToFen(_newPos) ); 
         },
         fen = function() { return _theBoard.fen(); };

         return { 
            init : init,
            refresh : refresh,
            destroy : destroy,
            resetToStart : resetToStart,
            clearAllPieces : clearAllPieces,
            setPosition : setPosition,
            isSnapshotState : isSnapshotState,
            fen : fen
         };

      }(),           // end board
   });


   _.extend(Proto, {
      /* A lot of the functionality of the gadget is in this view object,
       * especially, all the dom manipulation should be in here.
       */
      view: function() {
         var me = null,          // Access to all objects that were added onto variable Proto via _.extend()
                                 // Cached access to DOM elements:
            $mainControls,       //    Auxillary controls & display area for exercises & challenge 
            $titleText,          //    Where the title of the gadget gets displayed, set to either 'Chess', 'Snapshot', 'Sequence', or 'Challenge'
            $resetBtn,           //    The reset gadget button that is displayed to the author once an exercise type is chosen
            $statusModal,        //    The pop-up modal thrown up when reset button is pressed
            $commentEntry,       //    Where author enters comments/notes for frames in snpashot/sequence/challenge
            $notationDisplay;    //    Where gadget displays FEN notation or last moved recorded; both authors & leaners


         /* The $mainControls sits to the right of the chessboard and wraps basically all the controls except for reset-button.
            It has 4 vertically stacked container divs: _section0 to _section3;
          */
         var section = function( which ) {
               var obj = {};

               $mainControls.append( '<div id="section' + which + '" class="section"></div>' ); // inject into DOM

               obj.$el = $( '#section' + which );               
               obj.html = function( markup ) { obj.$el.html( markup ); };

               return obj;
            },
            _section0,           // Just for vertical spacing from top
            _section1,           // Holds different buttons based on exercise type author chose
            _section2,           // Either note/comment entry area or where move notation is displayed.
            _section3;           // same as _section2



         var init = function ( thisPointer ) {
               if ( me === null ) { 
                  me = thisPointer;                      
               }

               $mainControls = $( '#mainControls' );
               $titleText = $( '#titleText' );
               $resetBtn = $( '#resetBtn' );
               $statusModal = $( '#statusModal' );

               _section0 = section( 0 );
               _section1 = section( 1 );
               _section2 = section( 2 );
               _section3 = section( 3 );

               reset();                   
            },

            setTitle = function( str ) { $titleText.html( '<span class="title">' + str + '</span>'  ); },

            reset = function() {
               // Hide reset gadget button; will be visible again after author chooses exercise type
               $resetBtn.hide();
            },


            /* Prompt exercise & challenge creation options for author;
             */
            promptForExerciseType = function() {
               var markup = 
                  '<div id="exerciseTypeChoices" class="author-only"> \
                     <strong>Choose an exercise to create</strong><br>\
                     <p>Create a snapshot of a position or opening<br>\
                     <div class="buttonType1 exerciseChoice">snapshot</div></p>\
                     <p>Show and annotate a series of moves<br>\
                     <div class="buttonType1 exerciseChoice">sequence</div></p>\
                     <p>Challenge your learners with a chess problem<br>\
                     <div class="buttonType1 exerciseChoice">challenge</div></p>\
                  </div>';

               setTitle( 'Chess' );

               _section1.html( markup );

               makeStdButton( _section1.$el.find( '.exerciseChoice' ), function(e) {
                  me.state.exerciseType = e.text().charAt(0).toUpperCase() + e.text().slice(1);
                  _section1.$el.empty();
                  $resetBtn.show();
                  buildDisplay( me.state.exerciseType );
               }, 'color-grey', '355px');
            },


            makeStdButton = function( $el, fn, colorClass, width ) {
               $el.css( 'width', width );
               makeButton( $el, fn );
               $el.addClass( colorClass );
            },

            makeFancyButton = function( $el, fn, color, width ) {
               $el.css( 'background', color ).css( 'width', width );
               makeButton( $el, fn );
            },


            makeButton = function( $el, fn  ) {                  // Make a button out of ui element;
               $el.on('click', function(e) {
                  $(this)
                     .hide()                    // Turn button off & on for visual feedback.
                     .fadeIn( 175, function() { 
                        fn( $(this) );          // invoke passed in handler, and pass it jquery ref to element
                     });
               });
            },


            // Reset gadget for author to state before choosing which exercise type to create
            makeResetButton = function( $el ) {
               $el.off();     // Make sure to take off all handlers from before
               makeButton( $el, function(e) {
                  statusMessage( 'Are you sure you want to reset the gadget ?', 
                     function() {
                        $(this).fadeOut( '75' );
                        $statusModal.empty();
                        $statusModal.css( 'display', 'none' );
                        $commentEntry.remove();
                        _section1.$el.empty();
                        _section2.$el.empty();
                        _section3.$el.empty();
                        reset();
                        me.reset();
                        me.persistToVSPlayer( { exerciseType: undefined, recording: undefined } );
                        me.board.resetToStart();
                        setTitle( '' );
                        promptForExerciseType();
                     }
                  );
               });
            },



            statusMessage = function( str, fn ) {
               var cancel = function() {
                  $statusModal.empty();
                  $statusModal.css( 'display', 'none' );
                  $('body').off( 'keyup.statusMsg' );
               };
               
               $statusModal.css( 'display', 'block' )
                  .append( '<p class="msg">' + str + '</p>' )
                  .append( '<div class="centered" style="width: 225px">\
                     <div id="no" class="buttonType1" style="display: inline-block">no</div>\
                     <div id="yes" class="buttonType1 spacing1" style="display:inline-block">yes</div></div>' );

               makeStdButton( $statusModal.find( '#no' ), cancel, 'color-grey', '100px' );
               makeStdButton( $statusModal.find( '#yes' ), fn, 'color-green', '100px' );

               $('body').on( 'keyup.statusMsg', function(e) {      // catch esc key
                  if ( e.keyCode === 27 ) {
                     $('body').off( 'keyup.statusMsg' );
                     cancel();
                  }
               });
            },


            jumpToSnapshot = function() {
               me.board.setPosition( me.state.recording[0].pos );
               _section2.$el.find( '.comment' ).remove();
               _section2.$el.append( '<span class="comment">' + me.state.recording[0].comment + '</span>' );
               $notationDisplay.html( '<p class="highlight1">' + me.state.recording[0].pos + '</p>' );
            },

            // Called everytime user switches between Author and Learner modes in Versal player.
            toggleAuthorLearner = function ( isAuthorMode ) {
               var markup,
                  fn;

               // First turn on or off all elements that are author-mode specific
               $mainControls.find('.author-only').css( 'display', ( isAuthorMode ? 'block' : 'none' ) );
               $resetBtn.css( 'visibility', ( isAuthorMode ? 'visible' : 'hidden' ) );

               // If an exercise type hasn't been set author, there's nothing else to check for, just return.
               if ( me.state.exerciseType === undefined ) return;


               if ( me.state.exerciseCreated ) {                      // --==> Exercise Created

                  switch ( me.state.exerciseType ) {
                     case 'Snapshot' :
                        if ( isAuthorMode ) {                        // --==> SNAPSHOT Created, AUTHOR mode
                           _section1.$el.find( '#showSnapshot' ).remove();
                           _section2.$el.find( '.comment' ).remove();
                        }
                        else {                                       // --==> SNAPSHOT Created, LEARNER mode
                           jumpToSnapshot();    // jump to snapshot by default on going to learner mode
                        }
                        break;

                     case 'Sequence' :
                        if ( isAuthorMode ) {                        // --==> Sequence Created, AUTHOR mode
                           _section1.$el.find( '#topRow' ).css( 'display', 'inline-block' );
                           _section1.$el.find( '#record' ).show();
                        }
                        else {                                       // --==> Sequence Created, LEARNER mode
                           _section1.$el.find( '#record' ).hide(); 
                           readyToPlaySequence();
                        }
                        break;

                     case 'Challenge' :
                        var learnerControls = _section1.$el.find( '#learnerControls' );

                        if ( isAuthorMode ) {
                           learnerControls.hide();
                           _section3.$el.find( '.comment' ).remove();
                           _section3.$el.find( '#challengeBox' ).text( 'Challenge Solution' );
                           me.state.challengeStarted = false;  // in case there was a switch to author mode in the middle of a challenge
                        } 
                        else {                                       // --==> Challenge Created, LEARNER mode
                           if ( ! me.state.challengeStarted ) {
                              initChallenge();
                           }

                           me.board.setPosition( me.state.recording[0].pos );     // position board to 1st frame in recording 

                           markup = '<div id="learnerControls"> \
                                 <div id="try" class="buttonType1 spacing1 smallerPadding">try challenge</div>\
                              </div>';

                           if ( learnerControls.length === 0 ) {
                              _section1.$el.append( markup );

                              makeStdButton( _section1.$el.find( '#try' ), function( btn ) {
                                 me.board.setPosition( me.state.recording[0].pos );     // position board to 1st frame in recording
                                 btn.off().text( 'waiting for your move...' );
                                 _section2.$el.empty().append( '<span class="comment">' + ( me.state.recording[0].comment || " " )  + '</span>' );
                                 _section3.$el.find( '#challengeBox' ).text( 'Your move' );
                                 me.state.challengeStarted = true;  
                              }, 'color-green', '170px' );

                           } else {
                              learnerControls.show();
                           }

                           _section2.$el.empty().append( '<span class="comment">' + ( me.state.recording[0].comment || " " )  + '</span>' );
                           _section3.$el.find( '#challengeBox' ).text( '' );
                           $notationDisplay.empty().append( '<p id="movements"><span id="move0" class="move chicklet1 rounded ">0.start</span></p>' );                           
                           _section3.$el.find( '.comment' ).remove();
                        }

                        break;
                  }
               }
               else {                                                // --==> Exercise NOT yet created
                  switch ( me.state.exerciseType ) {
                     case 'Sequence':
                        // Take care of switching to learner mode in the middle of recording.
                        if ( me.state.recordingStarted && !me.state.recordingFinished ) {
                           stopRecording();
                        }
                     break;

                     default:
                     break;
                  }
               }
            },



            // Display ui components based on which exercise type was chosen,
            // setup appropriate buttons to handle recording exercise types.; TODO: make it DRY
            buildDisplay = function( exerciseType ) {
               var markup;

               // // Make a reset gadget button which erases all authors recorded exercise info, and restats gadget from scratch
               makeResetButton( $resetBtn );

               setTitle( me.state.exerciseType );

               // Show exercise-specific buttons, etc
               switch ( me.state.exerciseType ) {
                  case 'Snapshot':
                     markup = '<div id="" class="author-only"> \
                        <div id="capture" class="buttonType1 smallerPadding">capture</div>\
                        <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );
                     makeStdButton( _section1.$el.find( '#capture' ), recordSnapshot, 'color-green', '171px' );     // TODO: should be 172 per spec but tweaked to make things line up
                     makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
                     makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Write a note or description about this position"></textarea>';
                     _section2.html( markup );                    // Section 2 holds the comment entry area
                     _section2.$el.css( 'height', '105px' );

                     markup = '<span class="faded1">FEN notation</span><br><div id="notationDisplay" class="textbox bordered"></div>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '105px' );

                     break;

                  case 'Sequence':
                     markup = '<div id="topRow" class="author-only"> \
                        <div id="record" class="buttonType1 smallerPadding">record</div>\
                        <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );

                     makeStdButton( _section1.$el.find( '#record' ), recordSequence, 'color-red', '81px' );                     
                     makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px'  );
                     makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                     markup = '<p class="faded1">Algebraic notation</p>\
                        <div class="lilControl flushRight">\
                           <div id="leftButton" class="lilButton leftButton lilArrow" title="go to previous frame"></div>\
                           <div id="rightButton" class="lilButton rightButton lilArrow" title="go to next frame"></div>\
                           <div id="eraseButton" class="lilButton eraseButton" title="erase last recorded frame"></div>\
                        </div>\
                        <div id="notationDisplay" class="textbox bordered"></div>';
                     _section2.html( markup );
                     _section2.$el.find( '.lilButton' ).hide(); // Erase enabled during recording; left/right enabled after recording
                     _section2.$el.css( 'height', '105px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Set board to start position, enter optional comment for start position here"></textarea>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '105px' );
                  
                    break;

                  case 'Challenge':                         // TODO: make dry; this is almost same code as snapshot
                     markup = '<div class="author-only"> \
                        <div id="set" class="buttonType1 smallerPadding">set challenge</div>\
                        <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );
                     makeStdButton( _section1.$el.find( '#set' ), recordChallenge, 'color-green', '171px' );
                     makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
                     makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Enter instructions for your challenge here.\n\nTo create a challenge, set your initial position on the board, then click set challenge"></textarea>';
                     _section2.html( markup );                    // Section 2 holds the comment entry area
                     _section2.$el.css( 'height', '105px' );

                     markup = '<div class="author-only"><span id="challengeBox" class="faded1">Challenge Solution</span><br><div id="notationDisplay" class="textbox bordered"></div></div>';
                     _section3.html( markup );
                     _section3.$el.find( '#notationDisplay' ).css( 'height', '30px' );

                    break;

                  default:
                    break;
               }

               $commentEntry = $mainControls.find( '#commentEntry' );
               $notationDisplay = $mainControls.find( '#notationDisplay' );


               // If a BROWSER REFRESH happened, Versal player comes back in Leaner mode;
               // do exercise-specific initialization based on the pre-recorded exercise
               if ( me.state.exerciseCreated === true ) {
                  switch ( me.state.exerciseType ) {
                     case 'Snapshot':
                        me.board.setPosition( me.state.recording[0].pos );
                        _section2.$el.append( '<span class="comment">' + me.state.recording[0].comment + '</span>' );
                        break;

                     case 'Sequence':
                        $notationDisplay.append( generateDiffList( me.state.recording[ me.state.recording.length - 1 ].delta ) );
                        me.board.setPosition( me.state.recording[ me.state.recording.length - 1 ].pos );
                        _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " ) + '</span>' );                        
                        enableArrowButtons();
                        enableClickOnFrame();                        
                     break;

                     case 'Challenge':
                     break;

                     default:
                     break;
                  }
                  me.state.recordingFinished = true;
                  $resetBtn.show();
               }

            },


            // Callback for Snapshot button, EXERCISE 1
            recordSnapshot = function() {
               // If there is a previously recorded snapshot, we'll want to replace it
               if ( me.state.exerciseCreated ) {
                  me.state.recording.pop();
               }

               me.state.recording.push( { pos: me.board.fen(), comment: $commentEntry.val().trim() } );
               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;

               _section1.$el.find( '#capture' ).text( 're-capture' );
               $notationDisplay.html( '<p class="highlight1">' + me.board.fen() + '</p>' );
            },


            // Callback for Sequence Record on/off button, EXERCISE 2
            recordSequence = function( button ) {
               // turn off catching button press for now, and add class to show user recording started
               button.off(); 
               button.text( 'stop' );

               // If a previous recording exists, we want to add to it
               if ( me.state.recordingFinished ) {
                  me.state.exerciseCreated = false;

                  _section2.$el.find( '.lilArrow' ).off().hide();       // Turn off left/right buttons during recording
                  $notationDisplay.find('.move').removeClass('highlight2');
                  $notationDisplay.find('.move').last().addClass('highlight2');

                  // restore the textarea that was removed when recording was stopped.
                  var markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" maxlength="310" placeholder="Set board to start position and enter comment for it here"></textarea>';
                  _section3.html( markup );
                  _section3.$el.css( 'height', '105px' );
                  $commentEntry = _section3.$el.find( '#commentEntry' );

                  me.board.setPosition( me.state.recording[ me.state.recording.length - 1 ].pos  );
               }
               else {      // Start a new Sequence recording
                  me.state.recording.push({                  // save current position as starting position
                     pos: me.board.fen(), 
                     comment: $commentEntry.val().trim(), 
                     delta: 'start' 
                  });
                  $notationDisplay.append( '<p id="movements"><span id="lastRecorded" class="chicklet1 highlight2 rounded">0.start</span></p>' );
               }

               me.state.recordingStarted = true;
               me.state.recordingFinished = false;

               _section1.$el.find( '#reset' ).hide();
               _section1.$el.find( '#clear' ).hide();

               $commentEntry.attr( 'placeholder', 'Recording started, enter optional note for step ' + me.state.recording.length );  
               $commentEntry.val('');                  // empty out to enable next comment

               _section2.$el.find( '#eraseButton' ).off().show();  // show erase button; TODO: should probably only show after at least 1 frame besides start is recorded.

               // Handler for erase button, only active during recording
               makeButton( _section2.$el.find( '#eraseButton' ), function() {
                  var html;

                  if ( me.state.recordingStarted && !me.state.recordingFinished && me.state.recording.length > 1 ) {
                     me.state.isDeleting = true;
                     me.state.recording.pop();
                     me.board.setPosition( me.state.recording[ me.state.recording.length - 1 ].pos );
                     $notationDisplay.find( '.move' ).last().remove();
                     $notationDisplay.find( '.move' ).last().addClass( 'highlight2' );

                     me.persistToVSPlayer( { recording: me.state.recording } );
                     $commentEntry.attr( 'placeholder', 'Enter optional note for step ' + me.state.recording.length );                     
                  }
               });


               _section1.$el.find( '#play' ).hide();
               // Handler for next click to stop the recording
               button.one( 'click', stopRecording );
            },


            // called after hitting recording button to stop, or switch to learner mode in the middle of recording sequence
            stopRecording = function() {   
               var button = _section1.$el.find( '#record' );   // the start/stop recording button

               button.text( 'record' );

               _section1.$el.find( '#play' ).show();
               _section2.$el.find( '#eraseButton' ).off().hide();      // turn off erase button

               $commentEntry.remove();          // with a recording finished, we no longer need the textarea
               _section3.$el.append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " )  + '</span>');  // put comment from last frame in new comment area

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;  

               // Show the 'play' button if its not already showing
               readyToPlaySequence();

               makeButton( button, recordSequence );    // setup to enable restarting recording

               _section1.$el.find( '#reset' ).show();
               _section1.$el.find( '#clear' ).show();

               enableArrowButtons();
               enableClickOnFrame();
            },


            // call this after stopping recording to create the play button,  
            // call it again in learner mode to make it displayable in learner mode (!)
            readyToPlaySequence = function( delay ) {
               var topRow = _section1.$el.find('#topRow'),
                  $thePlayButton,
                  setupPlayButton = function() {
                     makeStdButton( $thePlayButton, function() {  // enable the Play sequence button
                        var i = 0,
                        timeoutID,        // TODO: have to deal with author/learner switch during playback... make this global?
                        loopAndPause = function() {
                           var elt;
                           _section2.$el.find( '.move' ).removeClass( 'highlight2' );        // clear highlights
                           _section2.$el.find( '#move' + i ).addClass( 'highlight2' );       // target current one in loop
                           me.board.setPosition( me.state.recording[i].pos );                // take board to that position
                           _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[i].comment || " " ) + '</span>' );
                           if ( timeoutID ) window.clearTimeout( timeoutID );             // pause, then advance to next one
                           if ( i < ( me.state.recording.length - 1 ) ) {
                              i++;
                              timeoutID = window.setTimeout( loopAndPause, 1000 );
                           } else {
                              enableClickOnFrame();
                              enableArrowButtons();
                              _section1.$el.find( '#record' ).show();    
                              _section1.$el.find( '#reset' ).show();                    
                              _section1.$el.find( '#clear' ).show();
                              setupPlayButton();
                           }
                        };

                        $thePlayButton.off();
                        _section2.$el.find( '.move' ).off();     // turn off clicking on frames during playback
                        _section2.$el.find( '.lilArrow').off();   // turn off arrow buttons for now too

                        _section1.$el.find( '#record' ).hide();
                        _section1.$el.find( '#reset' ).hide();                    
                        _section1.$el.find( '#clear' ).hide();

                        loopAndPause();
                     }, 'color-green', '81px' ); 
                  };

               if ( _section1.$el.find( '#play' ).length !== 0 ) {  // if there IS an existing play button
                  return;
               }
               else {      // we have to create play button
                  _section1.$el.prepend( '<div id="play" class="buttonType1 smallerPadding">play</div>' );
                  _section1.$el.find( '#play').css( 'margin-right', '9px' );  //  10px makes things go over!
                  $thePlayButton = _section1.$el.find( '#play' );
                  setupPlayButton();
               }
            },


            // Make arrow buttons clickable for Author & Leaner; called after a recording is finished     
            enableArrowButtons = function() {
               _section2.$el.find( '.lilArrow' ).show();   // show arrow buttons

               _section2.$el.find( '.lilArrow' )       
                  .on( 'click', function(e) {
                     $(this).hide().fadeIn( 150, function() { 
                        var frame = $notationDisplay.find('.highlight2').text().trim();      // set frame initially to last one in list

                        frame = ( frame.slice(0, frame.indexOf('.')) ) * 1;     // extract frame #, cast to number           
                        if ( $(this).context.id === 'leftButton' )  {
                           if ( frame == 0 ) { return; }
                           $notationDisplay.find('.highlight2').removeClass('highlight2').prev().addClass('highlight2');
                           frame--;
                        }
                        else {            // go Right 
                           if ( frame == me.state.recording.length - 1 ) { return; }
                           $notationDisplay.find('.highlight2').removeClass('highlight2').next( ).addClass('highlight2');
                           frame++;
                        }
                        me.board.setPosition( me.state.recording[frame].pos );
                        _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[frame].comment || " " ) + '</span>' );
                     });
                  });
            },



            // Make each frame in sequence recording clickable for Author & Leaner; called after a recording is finished
            enableClickOnFrame = function() {
               _section2.$el.find('.move')
                  .addClass('cursor1')
                  .on( 'click', function(e) {   // handler to allow jumping to any step in the recorded sequence
                     var frame = $(e.target).text().trim();          // get text from the html for frame #

                     _section2.$el.find('.move').removeClass('highlight2');
                     $(e.target).addClass('highlight2');
                     frame = frame.slice(0, frame.indexOf('.'));     // extract frame #
                     me.board.setPosition( me.state.recording[frame].pos );
                     _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[frame].comment || " " ) + '</span>' );
               });
            },


/*  
* The end of sequence stuff, now the challenge...
*/

            // initChallenge - called in learner mode after challenge has been created by author.
            initChallenge = function() {
               var challenges = [{
                     answers: me.state.recording[1].pos,       // This contains the correct answer to the challenge
                     scoring: 'strict'
                  }];

               me.state.challengesApi = me.state.challengesApi || new VersalChallengesAPI( function(response){
                  var matchFound = ( response.scoring.totalScore || 0 );

                  if ( me.state.challengeStarted && me.state.challengeFinished ) {
                     if ( matchFound > 0 ) {
                        _section3.$el.append('<p class="comment challengeResult correct">Correct!</p>');
                     } else {
                        _section3.$el.append('<p class="comment challengeResult incorrect">Incorrect</p>');
                     }

                     me.state.challengeStarted = false;
                     me.state.challengeFinished = false;

                     _section1.$el.find( '#try' ).text( 'retry challenge' );

                     makeStdButton( _section1.$el.find( '#try' ), function( btn ) {
                        me.board.setPosition( me.state.recording[0].pos );     // position board to 1st frame in recording                                  
                        btn.off().text( 'waiting for your move...' );
                        _section2.$el.empty().append( '<span class="comment">' + ( me.state.recording[0].comment || " " )  + '</span>' );
                        _section3.$el.find( '.comment' ).remove();
                        $notationDisplay.empty().append( '<p id="movements"><span id="move0" class="move chicklet1 rounded ">0.start</span></p>' );
                        me.state.challengeStarted = true;  
                     }, 'color-green', '170px' );
                  }
               });

               me.state.challengesApi.setChallenges( challenges );
            },


            recordChallenge = function( button ) {
               var markup;
               _section1.$el.find( '.buttonType1').remove(); 

               if (  me.state.recordingFinished ) {      // A previous recording exists
                  // TODO: delete recording[1] ??
                  // Other option is to also delete the starting position but that's the same as starting
                  // over and you can use the reset button for that.
               } 
               else {            // Brand new recording
                  me.state.recording.push({                  // save current position as starting position
                     pos: me.newPos || me.board.fen(),
                     comment: $commentEntry.val().trim(),
                     delta: 'start'
                  });
                  _section2.$el.append( '<p>Starting position for challenge set.  Now move a chess piece to define correct end state.</p>');
               }

               me.state.recordingStarted = true; 
               me.state.recordingFinished = false;

               markup = '<div class="author-only"> \
                  <div id="setting" class="buttonType1 ">setting challenge...</div>\
                  <div id="cancel" class="buttonType1 spacing1">cancel</div>\
                  </div>';
               _section1.$el.append( markup );

               makeFancyButton( _section1.$el.find( '#setting' ), function() {}, '#aaa', '170px' );
               makeStdButton( _section1.$el.find( '#cancel' ), function() {
                  // TODO: all this code is a straight copy from buildDisplay()
                  var markup = '<div class="author-only"> \
                     <div id="set" class="buttonType1 smallerPadding">set challenge</div>\
                     <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                     <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                  </div>';

                  _section1.html( markup );                  
                  _section1.$el.css( 'height', '34px' );
                  makeStdButton( _section1.$el.find( '#set' ), recordChallenge, 'color-green', '150px' );
                  makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
                  makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                  markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" maxlength="310" placeholder="Enter instructions for your challenge here.\n\nTo create a challenge, set initial position on board, then click set challenge button"></textarea>';
                  _section2.html( markup );
                  _section2.$el.css( 'height', '105px' );
                  $commentEntry = $('#commentEntry');
                  $commentEntry.val( me.state.recording[0].comment );

                  _section3.$el.find( '.comment' ).remove();

                  $notationDisplay.empty();

                  me.state.recording.pop();
                  me.state.recordingStarted = false;
               }, 'color-grey', '170px' );

               $commentEntry.remove();          
               _section3.$el.append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " )  + '</span>');  // put comment from last frame in new comment area

               $notationDisplay.append( '<p id="movements"><span id="move0" class="move chicklet1 rounded ">0.start</span></p>' );
            },


            // After a challenge recording is started, a chess-piece move triggers a call to this method.
            stopRecordingChallenge = function() {
               var markup = '<div class="author-only"> \
                  <div id="set" class="buttonType1 smallerPadding">reset challenge</div>\
                  <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                  <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
               </div>';

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;

               _section1.html( markup );                     // Section 1 holds the buttons
               _section1.$el.css( 'height', '34px' );
               makeStdButton( _section1.$el.find( '#set' ), function() {
                  me.persistToVSPlayer( { exerciseType: undefined, recording: undefined } );
                  me.board.setPosition( me.state.recording[0].pos );
                  me.state.recording = [];
                  me.state.exerciseCreated = false;
                  me.state.recordingFinished = false;
                  me.state.recordingStarted = false;
                  _section2.$el.empty();
                  $notationDisplay.empty();
                  recordChallenge();
               }, 'color-green', '150px' );
               makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
               makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

               _section2.$el.empty().append( '<p>Challenge defined.</p>');

               _section3.$el.find( '.author-only' ).removeClass( 'author-only'); // Make the 'Challenge solution' visible to learner
            },


            
            // Return key/val in b thats not in a
            objectDiff = function ( a, b ) {
               var result = {};
               for (var i in b) {
                  if ( a[i] !== b[i] ) {
                     result[i] = b[i];
                  }
               }
               // Turn into a string, take out non-alphanum characters, return it
               return JSON.stringify(result).replace(/[^\w\s]/gi, '');   
            },


            // Put together html string containing the changes between each recorded move,
            // called mainly by handleChessPieceMoveEvent() but also after browser refresh prompts re-displaying recorded sequence.
            generateDiffList = function( moveDetail ) {
               var i, 
               moves = '<p id="movements" class="challengeAuthorOnly"><span id="move0" class="move chicklet1 rounded ">0.start</span>';

               for ( i = 1; i < me.state.recording.length; i++ ) {
                  moves += ( '   <span id="move' + i + '" class="move chicklet1 rounded ' );
                  if ( me.state.exerciseType === 'Challenge' ) moves += 'chicklet2 ';    // class for Challenge
                  if ( i === me.state.recording.length - 1 ) {
                     moves += ( 'highlight2">    ' + i + '.' + moveDetail );
                  } else {
                     moves += ( '">    ' + i + '.' + me.state.recording[i].delta );
                  }
                  if ( ( (i+1) % 5 === 0) ) moves += '\n';          // TODO: this is a hack to fit 5 moves per line of the textbox
                  moves += '</span>';
               }
               moves += '</p></span>';

               return moves;
            },


            // Called upon every movement of a piece on the board, or clear, or reset.
            // Necessary for recording exercises
            handleChessPieceMoveEvent = function( oldPos, newPos ) {
               var markup;
               // For snapshots only
               if ( me.state.exerciseType === 'Snapshot' ) {
                  $notationDisplay.html( '<p class="">' + ChessBoard.objToFen(newPos) + '</p>' );

                  if ( me.state.exerciseCreated && !me.editable && _section1.$el.find( '#showSnapshot').length === 0 && !me.board.isSnapshotState() ) {
                     markup = '<div id="showSnapshot" class="buttonType1 smallerPadding">return to snapshot</div>';
                     _section1.$el.append( markup );
                     makeStdButton( _section1.$el.find( '#showSnapshot' ), function(btn) { 
                        jumpToSnapshot();
                        $(btn).remove();
                     }, 'color-green', '172px' );                           
                  }

                  return;
               }

               // // For Sequence and Challenge recordings, only
               var lastDiff;

               if ( me.state.recordingStarted && !me.state.recordingFinished && !me.state.isDeleting) {
                  lastDiff = objectDiff( oldPos, newPos );

                  me.state.recording.push({ 
                     pos: newPos,                               // Record the movement for the sequence
                     comment: $commentEntry.val().trim(),
                     delta: lastDiff
                  });

                  $commentEntry.val('');                 // empty out to enable next comment 
                  
                  if ( me.state.exerciseType === 'Challenge' ) {
                     $notationDisplay
                        .empty()
                        .append( '<span class="challengeAuthorOnly"></span>')
                        .append( generateDiffList( lastDiff ) );
                     stopRecordingChallenge();
                  }
                  else {   // for sequence only
                     $commentEntry.attr( 'placeholder', 'Enter optional note for step ' + me.state.recording.length );                  
                     $notationDisplay.html( generateDiffList( lastDiff ) );
                  }                
               }

               if ( me.state.isDeleting ) me.state.isDeleting = false;

               // For challenge (only) in learner mode
               if ( me.state.challengeStarted && ! me.state.challengeFinished && me.state.exerciseType === 'Challenge' && !me.editable ) {
                  me.state.challengeFinished = true;
                  lastDiff = objectDiff( oldPos, newPos );
                  $notationDisplay.empty().append( generateDiffList( lastDiff ) );
                  me.state.challengesApi.scoreChallenges( [ newPos ] ); 
               }               
            };


         return {
            init : init,
            reset : reset,
            promptForExerciseType : promptForExerciseType,
            buildDisplay : buildDisplay,
            toggleAuthorLearner : toggleAuthorLearner,
            chessPieceMoveEvent : handleChessPieceMoveEvent
         };
      }()         // end view
   });


   //add some common methods
   _.extend(Proto, BaseCompMethods);

   document.registerElement('vs-chess', {
      prototype: Proto
   });

}());
