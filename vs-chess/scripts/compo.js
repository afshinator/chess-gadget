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
      /* -- state saved on this object :
         editable          -  Set by vs player; true : author mode,  false : learner mode
         config            -  Set by vs player; the persisted gadget data

         this.state created hold the rest of the widget state, see reset().
      */

      init: function() {
         this.reset();

         this.board.init( this );
         this.view.init( this );                        // initialize the UI component

         // this.config contains authors persisted exercise info from Versal platform
         if ( this.config.exerciseType !== undefined && this.config.exerciseType !== null ) {
            console.log('Chess gadget recovered saved data.');
            this.state.exerciseType = this.config.exerciseType;
            this.state.exerciseCreated = true;
            this.state.recording = this.config.recording;

            this.view.buildDisplay( this.state.exerciseType );            // Build the auxillary controls based on exerciseType
         }
         else {  // No exercise info found in config
            console.log('Chess gadget found no previous saved data.');
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
         // console.log('createdCallback');
         this.innerHTML = _template.innerHTML;
         this.$el = $(this);
      },

      attachedCallback: function(){
         // toggleBoard(false);
      },

      detachedCallback: function(){
         // this.toggleMouse(false);
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
               // return !_.isEqual( oldV.position, newV.position );
               return ! ( oldV.position ===  newV.position );          // TODO: _.isEqual was necessary for comparing position objects, but not for strings
            }
         }


         // The first time this handler fn is called (at gadget startup),
         // initialize the auxillary UI stuff.   
         if ( this.state === undefined ) {  // this.state is not declared above, so will be undefined
            this.state = { };
            this.init();                                  //
         }

         switch (attrName) {
            case 'editable':                // Event indicates toggle between Author/Learner mode
               this.board.refresh(); // this.toggleBoard(this.editable);
               this.toggleAuthorLearner( this.editable );
               break;

            case 'data-config':             // Event indicates prop-sheet changes OR chessboard move
               if ( ! pieceMoved() ) {       // If its not a piece movement, its a prop sheet change
                 this.board.refresh(); // this.toggleBoard(this.editable);
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
                  // me.view.chessPieceMoveEvent( ChessBoard.objToFen(oldPos), ChessBoard.objToFen(newPos) );
                  me.view.chessPieceMoveEvent( oldPos, newPos );                     
               };

            var cfg,
               position = _newPos || 'start';    //this.config is undefined in detachedCallback for Chrome36

            cfg = {
               draggable: ( allowMovement === undefined ) ? true : allowMovement,
               showNotation: (me.config && me.config.showNotation !== undefined ) ? me.config.showNotation : false,
               // setting a default for sparePieces in versal.json breaks draggable: false !!
               sparePieces : true, // (me.config && me.config.sparePieces !== undefined ) ? me.config.sparePieces : false,
               orientation: (me.config  && (me.config.flipped === true) )  ? 'black' : 'white',
               dropOffBoard: 'trash', // (me.config && me.config.dropOffBoard === true ) ? 'trash' : 'snapback',
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
            // TODO: chess.js stuff
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
      /* The View holds 
       */
      view: function() {
         var me = null,
            $mainControls,
            $titleText,
            $resetBtn,
            $statusModal,
            $commentEntry,
            $notationDisplay;

         var section = function( which ) {
               var obj = {};

               $mainControls.append( '<div id="section' + which + '" class="section"></div>' ); // inject into DOM

               obj.$el = $( '#section' + which );               
               obj.display = function( markup ) { obj.$el.empty().append( markup ); };
               obj.html = function( markup ) { obj.$el.html( markup ); };

               return obj;
            },
            _section0,
            _section1,
            _section2,
            _section3;

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

/*
               // helps turn on section 0 images based on exercise type
               _section0.displayButtonsForExercise = function ( exerciseType ) {
                  _section0.$el.find( '.' + exerciseType.toLowerCase() ).css( 'display', 'inline-block' );
               };

               _section2.$commentEntry = _section2.$el.find( '#commentEntry' );
               _section2.commentEntered = function() { return _section2.$commentEntry.val().trim(); };
               _section2.showCommentEntry = function() { _section2.$commentEntry.css( 'display', 'block' ); };
               _section2.hideCommentEntry = function() { _section2.$commentEntry.css( 'display', 'none' ); };
               _section2.placeholder = function(txt) { _section2.$commentEntry.attr( txt ); };
               _section2.clearCommentEntry = function() { _section2.$commentEntry.val( '' ).attr( 'placeholder', '' ); };

               _section3.putComment = function(txt) { 
                  _section3.$el.find('.comment').remove(); 
                  _section3.$el.prepend( txt );          // prepend because the restart button also goes in section 3
               };
               _section3.removeComment = function() { _section3.$el.find('.comment').remove(); };

               reset();
*/               
            },

            displayOff = function( el ) { el.css( 'display', 'none' ); },

            displayOn = function( el, inlineBlock ) { el.css( 'display', inlineBlock ? 'inline-block' : 'block' ); },

            setTitle = function( str ) { $titleText.html( '<span class="title">' + str + '</span>'  ); },

            reset = function() {
/*
               // Turn off handlers for top row buttons and hide them
               displayOff( _section0.$el.find( '.pic' ).off() );

               // In case was in the middle of recording, turn off animations
               _section0.$el.find( '#pic2' ).removeClass( 'animate1' );  // 

               // Remove borders around section (not there at gadget startup, but left over after a reset)
               _section1.$el.removeClass( 'bordered' );

               // hide comment entry textarea
               displayOff( _section2.$commentEntry );

               // In case we were showing comments from previous recording, clear it out
               _section3.$el.empty();               

               // $statusModal.hide();
*/
               // Hide reset gadget button; will be visible again after author chooses exercise type
               $resetBtn.hide();
            },


            /* Prompt exercise & challenge creation options for author;
             */
            promptForExerciseType = function() {
               var $buttons,
                  markup = 
                  '<div id="exerciseTypeChoices" class="author-only"> \
                     <strong>Choose an exercise to create</strong><br>\
                     <p>Create a snapshot of a position or opening<br>\
                     <div class="buttonType1 exerciseChoice">snapshot</div></p>\
                     <p>Show and annotate a series of moves<br>\
                     <div class="buttonType1 exerciseChoice">sequence</div></p>\
                     <p>Challenge your learners with a chess problem<br>\
                     <div class="buttonType1 exerciseChoice">challenge</div></p>\
                  </div>';

               _section1.html( markup );
               $buttons = _section1.$el.find( '.exerciseChoice' );

               makeFancyButton( $buttons, function(e) {
                  me.state.exerciseType = e.text().charAt(0).toUpperCase() + e.text().slice(1);
                  _section1.$el.empty();
                  $resetBtn.show();
                  buildDisplay( me.state.exerciseType );
               }, "#7c7975", '355px');
            },


            makeFancyButton = function( $el, fn, color, width ) {
               color = color || "#7c7975"; 
               width = width || "100px";
               $el.css( 'background', color ).css( 'width', width );
               makeButton( $el, fn );
            },


            makeButton = function( $el, fn  ) {                  // Make a button out of ui element;
               // $el.css( 'height', '30px' );
               $el.on('mouseover mouseout click', function(e) {
                  if ( e.type === 'mouseover' ) {
                     $(this).addClass('buttonOver1');
                  } 
                  else if ( e.type === 'mouseout' ) {
                     $(this).removeClass('buttonOver1');
                  }
                  else if ( e.type === 'click' ) {
                     $(this).removeClass('buttonOver1')
                        .hide()                    // Turn button off & on for visual feedback.
                        .fadeIn( 175, function() { 
                           fn( $(this) );          // invoke passed in handler, and pass it jquery ref to element
                        });
                  }
               });
            },


            // Reset gadget for author to state before choosing which exercise type to create
            makeResetButton = function( $el ) {
               makeButton( $el, function(e) {
                  if ( confirm('Confirm that you want to reset the widget and forget your data?') ) {
                     console.log( '!!! Resetting Chess gadget !!!' );
                     $el.off();
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
               });
            },


            // Called everytime user switches between Author and Learner modes in Versal player.
            toggleAuthorLearner = function ( isAuthorMode ) {
               var markup;
               // First turn on or off all elements that are author-mode specific
               // $mainControls.find('.author-only').css( 'visibility', ( isAuthorMode ? 'visible' : 'hidden' )  );

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
                           markup = '<div id="showSnapshot" class="buttonType1">jump to snapshot</div>';
                           _section1.$el.append( markup );
                           
                           makeFancyButton( _section1.$el.find( '#showSnapshot' ), function() {
                              me.board.setPosition( me.state.recording[0].pos );
                              _section2.$el.append( '<span class="comment">' + me.state.recording[0].comment + '</span>' );
                              $notationDisplay.html( '<p class="highlight1">' + me.state.recording[0].pos + '</p>' );
                           }, '#3a968a', '150px' );

                        }
                    
                        break;

                     case 'Sequence' :
                        if ( isAuthorMode ) {                        // --==> Sequence Created, AUTHOR mode

                        }
                        else {                                       // --==> Sequence Created, LEARNER mode


                        }
                        break;
                  }
               }
               else {                                                // --==> Exercise NOT yet created
                  switch ( me.state.exerciseType ) {
                     case 'Snapshot':
                        if ( isAuthorMode ) {

                        } else {                                     // --==> SNAPSHOT NOT yet created, LEARNER mode
                           // no comment to show, fen notation should be in its place , so nothing to do.
                        }

                     break;

                     case 'Sequence':
                        // Take care of switching to learner mode in the middle of recording.
                        if ( me.state.recordingStarted && !me.state.recordingFinished ) {
                           stopRecording();
                        }
                     break;

                     case 'Challenge':
                     break;

                     default:
                        // TODO: throw an exception?
                     break;
                  }
               }


            },



            // Display ui components based on which exercise type was chosen,
            // setup appropriate buttons to handle recording exercise types.
            buildDisplay = function( exerciseType ) {
               var markup;

               // // Make a reset gadget button which erases all authors recorded exercise info, and restats gadget from scratch
               makeResetButton( $resetBtn );

               setTitle( me.state.exerciseType );

               // Show exercise-specific buttons, etc
               switch ( me.state.exerciseType ) {
                  case 'Snapshot':
                     markup = '<div id="" class="author-only"> \
                        <div id="capture" class="buttonType1">capture</div>\
                        <div id="reset" class="buttonType1 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );
                     makeFancyButton( _section1.$el.find( '#capture' ), recordSnapshot, '#3a968a', '150px' );
                     makeFancyButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); } );
                     makeFancyButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); } );

                     markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" placeholder="Write a note or description about this position"></textarea>';
                     _section2.html( markup );                    // Section 2 holds the comment entry area
                     _section2.$el.css( 'height', '105px' );

                     markup = '<span>FEN notation</span><br><div id="notationDisplay" class="textbox bordered"></div>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '105px' );

                     break;

                  case 'Sequence':
                     markup = '<div id="" class="author-only"> \
                        <div id="play" class="buttonType1">play</div>\
                        <div id="record" class="buttonType1 spacing1">record</div>\
                        <div id="reset" class="buttonType1 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );

                     makeFancyButton( _section1.$el.find( '#play' ), function(){}, '#3a968a', '81px' );
                     makeFancyButton( _section1.$el.find( '#record' ), recordSequence, '#ca403b', '81px' );                     
                     makeFancyButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, '#7c7975', '84px'  );
                     makeFancyButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, '#7c7975', '84px'  );

                     markup = '<p>Algebraic notation</p>\
                        <div class="lilControl flushRight">\
                           <div id="leftButton" class="lilButton leftButton lilArrow"></div>\
                           <div id="rightButton" class="lilButton rightButton lilArrow"></div>\
                           <div id="eraseButton" class="lilButton eraseButton"></div>\
                        </div>\
                        <div id="notationDisplay" class="textbox bordered"></div>';
                     _section2.html( markup );
                     _section2.$el.find( '.lilButton' ).hide(); // Erase enabled during recording; left/right enabled after recording
                     _section2.$el.css( 'height', '105px' );

                     markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" placeholder="Set board to start position and enter comment for it here"></textarea>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '105px' );
                     
                     me.addToPropertySheet( { 
                        playSpeed:  { type: 'Range', min: 1, max: 10, step: 1 }
                     } );

                    break;

                  case 'Challenge':                         // TODO: make dry; this is almost same code as snapshot
                     markup = '<div class="author-only"> \
                        <div id="set" class="buttonType1">set challenge</div>\
                        <div id="reset" class="buttonType1 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );                     // Section 1 holds the buttons
                     _section1.$el.css( 'height', '34px' );
                     makeFancyButton( _section1.$el.find( '#set' ), recordChallenge, '#3a968a', '150px' );
                     makeFancyButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); } );
                     makeFancyButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); } );

                     markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" placeholder="Enter instructions for your challenge here.\n\nTo create a challenge, set your initial position on the board, then click set challenge"></textarea>';
                     _section2.html( markup );                    // Section 2 holds the comment entry area
                     _section2.$el.css( 'height', '105px' );

                     markup = '<span>Challenge Solution</span><br><div id="notationDisplay" class="textbox bordered"></div>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '45px' );

                    break;

                  default:
                    break;
               }

               $commentEntry = $mainControls.find( '#commentEntry' );
               $notationDisplay = $mainControls.find( '#notationDisplay' );


               // If a BROWSER REFRESH happened, Versal player comes back in Leaner mode;
               // do exercise-specific initialization based on the pre-recorded exercise
               if ( me.state.exerciseCreated === true ) {
                  console.log('Chess gadget: Browser refresh with an exercise recorded happened.');

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
                  me.state.recordingFinished = true;        // TODO: necessary anymore ??
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

               $notationDisplay.html( '<p class="highlight1">' + me.board.fen() + '</p>' );

               // statusMessage( 'Snapshot done.  Click camera again to capture new snapshot.', true );
               // _section3.display( '<p class="comment">' + me.state.recording[0].comment + '</p>' );
            },


            // Callback for Sequence Record on/off button, EXERCISE 2
            recordSequence = function( button ) {
               // turn off catching button press for now, and add class to show user recording started
               button.off().addClass('animate1');

               // If a previous recording exists, we want to add to it
               if ( me.state.recordingFinished ) {
                  me.state.exerciseCreated = false;

                  _section2.$el.find( '.lilArrow' ).off().fadeOut();       // Turn off left/right buttons during recording
                  $notationDisplay.find('.move').removeClass('highlight2');
                  $notationDisplay.find('.move').last().addClass('highlight2');

                  // restore the textarea that was removed when recording was stopped.
                  var markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" placeholder="Set board to start position and enter comment for it here"></textarea>';
                  _section3.html( markup );
                  _section3.$el.css( 'height', '105px' );
                  $commentEntry = _section3.$el.find( '#commentEntry' );

                  me.board.setPosition( me.state.recording[ me.state.recording.length - 1 ].pos  );
               }
               else {      // Start a new Sequence recording
                  me.state.recording.push({                  // save current position as starting position
                     pos: me.board.fen(), // TODO:  old code: me.newPos || me.board.fen(), 
                     comment: $commentEntry.val().trim(), 
                     delta: 'start' 
                  });
                  $notationDisplay.append( '<p id="movements"><span id="lastRecorded" class="chicklet1 highlight2">0.start</span></p>' );
               }

               me.state.recordingStarted = true;
               me.state.recordingFinished = false;

               displayOff( _section1.$el.find( '#reset' ).off() );   // hide reset button
               displayOff( _section1.$el.find( '#clear' ).off() );   // hide clear button

               $commentEntry.attr( 'placeholder', 'Recording started, enter optional note for step 1' );  
               $commentEntry.val('');                  // empty out to enable next comment

               _section2.$el.find( '#eraseButton' ).off().fadeIn();  // show erase button

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

               // Handler for next click to stop the recording
               button.one( 'click', stopRecording );
            },


            // called after hitting recording button to stop, or switch to learner mode in the middle of recording sequence
            stopRecording = function() {   
               var button = _section1.$el.find( '#record' );   // the start/stop recording button

               button.off().removeClass('animate1');           // Stop the recording-in-progress animation

               _section2.$el.find( '#eraseButton' ).off().fadeOut();      // turn off erase button

               $commentEntry.remove();          // with a recording finished, we no longer need the textarea
               _section3.$el.append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " )  + '</span>');  // put comment from last frame in new comment area

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;  
               statusMessage("Recording sequence done. Click recorder button again to add or delete frames.", true ); 

               makeButton( button, recordSequence );    // setup to enable restarting recording

               enableArrowButtons();
               enableClickOnFrame();
            },


            // Make arrow buttons clickable for Author & Leaner; called after a recording is finished
            enableArrowButtons = function() {
               _section2.$el.find( '.lilArrow' ).fadeIn();   // show arrow buttons

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
                           $notationDisplay.find('.highlight2').removeClass('highlight2').next().addClass('highlight2');
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


            recordChallenge = function( button ) {
               // button.remove(); // off().text('setting challenge...');
               // _section1.$el.find( '#reset' ).remove();
               // _section1.$el.find( '#clear' ).remove();

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

               _section1.$el.append( '<div id="setting" class="buttonType1 spacing1">setting challenge...</div>' );
               _section1.$el.append( '<div id="cancel" class="buttonType1 spacing1">cancel</div>' );

               makeFancyButton( _section1.$el.find( '#setting' ), function() {}, '#aaa', '165px' );
               makeFancyButton( _section1.$el.find( '#cancel' ), function() {
// TODO: all this code is a straight copy from buildDisplay()
                  var markup = '<div class="author-only"> \
                     <div id="set" class="buttonType1">set challenge</div>\
                     <div id="reset" class="buttonType1 spacing1">reset pieces</div>\
                     <div id="clear" class="buttonType1 spacing1">clear board</div>\
                  </div>';

                  _section1.html( markup );                  
                  _section1.$el.css( 'height', '34px' );
                  makeFancyButton( _section1.$el.find( '#set' ), recordChallenge, '#3a968a', '150px' );
                  makeFancyButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); } );
                  makeFancyButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); } );

                  markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" placeholder="Enter instructions for your challenge here.\n\nTo create a challenge, set your initial position on the board, then click set challenge"></textarea>';
                  _section2.html( markup );
                  _section2.$el.css( 'height', '105px' );
                  $commentEntry = $('#commentEntry');
                  $commentEntry.val( me.state.recording[0].comment );

                  _section3.$el.find( '.comment' ).remove();

                  $notationDisplay.empty();

                  me.state.recording.pop();
                  me.state.recordingStarted = false;
               }, '#7c7975', '165px' );

               $commentEntry.remove();          
               _section3.$el.append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " )  + '</span>');  // put comment from last frame in new comment area

               $notationDisplay.append( '<span id="move0" class="move chicklet1 ">0.start</span>' );
            },


            // After a challenge recording is started, a chess-piece move triggers a call to this method.
            stopRecordingChallenge = function() {
               var markup = '<div class="author-only"> \
                  <div id="set" class="buttonType1">reset challenge</div>\
                  <div id="reset" class="buttonType1 spacing1">reset pieces</div>\
                  <div id="clear" class="buttonType1 spacing1">clear board</div>\
               </div>';

               // makeButton(   ).off().fadeIn(), function(e) {         //  erase end-state button
               //   me.state.recording.pop();  // get rid of challenge move, now only start position is left
               //   me.save( { exerciseType: me.state.exerciseType, recording: me.state.recording } );            
               //   me.state.exerciseCreated = false;
               //   me.board.setPosition( me.state.recording[0].pos );
               //   me.state.recordingFinished = false;
               //   button.addClass( 'animate1' );
               //   el.$sections[1].find('.move').off();  // disable clicking on frame
               //   el.$sections[1].empty()
               //     .append( '<p>Starting position set.  Now move a chess piece to define challenge completion state.</p>');
               //   // el.$commentEntry.show();              
               // }); 

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;

               _section1.html( markup );                     // Section 1 holds the buttons
               _section1.$el.css( 'height', '34px' );
               makeFancyButton( _section1.$el.find( '#set' ), function() {
                  // TODO: gotta get rid of recording, set my.state.exerciseCreated = false
                  me.persistToVSPlayer( { exerciseType: undefined, recording: undefined } );
                  me.state.recording = [];
                  me.state.exerciseCreated = false;
                  me.state.recordingFinished = false;
                  me.state.recordingStarted = false;
                  _section2.$el.empty();
                  $notationDisplay.empty();
                  recordChallenge();
               }, '#3a968a', '150px' );
               makeFancyButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); } );
               makeFancyButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); } );

               // if ( me.editable ) {    
               //    statusMessage("Recording challenge done. ", true ); 
               // }
            },


            statusMessage = function( str, bCenter ) {
               $statusModal.find( '.msg' ).remove();
               $statusModal.css( 'display', 'block' )
                  .append( '<h2 class="msg">' + str + '</h2>' )
                  .one( 'click', function() {
                     $(this).fadeOut('75');
                  });
               $('body').on( 'keyup.statusMsg', function(e) {      // catch esc key
                  if ( e.keyCode === 27 ) {
                     $('body').off( 'keyup.statusMsg' );
                     $statusModal.fadeOut('75');
                  }
               });
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
               moves = '<p id="movements" class="challengeAuthorOnly"><span id="move0" class="move chicklet1 ">0.start</span>';

               for ( i = 1; i < me.state.recording.length; i++ ) {
                  moves += ( '   <span id="move' + i + '" class="move chicklet1 rounded ' );
                  if ( me.state.exerciseType === 'Challenge' ) moves += 'chicklet2 ';    // class for Challenge
                  if ( i === me.state.recording.length - 1 ) {
                     moves += ( 'highlight2">    ' + i + '.' + moveDetail );
                  } else {
                     moves += ( '">    ' + i + '.' + me.state.recording[i].delta );
                  }
                  moves += '</span>';
               }
               moves += '</p></span>';

               return moves;
            },


            // Called upon every movement of a piece on the board, or clear, or reset.
            // Necessary for recording exercises
            handleChessPieceMoveEvent = function( oldPos, newPos ) {
               // For snapshots only
               if ( me.state.exerciseType === 'Snapshot' ) {
                  // if ( me.state.exerciseCreated && me.board.isSnapshotState() ) {
                  //    // _section3.putComment( '<p class="comment">' + me.state.recording[0].comment + '</p>' );
                  //    console.log( 'put in the comment now' );
                  // } else {
                  //    console.log( 'Ttake out the comment now' );
                  //    // _section3.removeComment();
                  // }

                  $notationDisplay.html( '<p class="">' + ChessBoard.objToFen(newPos) + '</p>' );
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

               // For challenge (only)
               if ( me.state.challengeStarted && ! me.state.challengeFinished && me.state.exerciseType === 'Challenge' && !me.editable ) {
                  me.state.challengeFinished = true;
                  me.state.challengesApi.scoreChallenges( [ChessBoard.objToFen( newPos )] );
               }               
            },


            last = function() {};


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
