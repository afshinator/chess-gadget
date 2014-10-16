/* global $, _, BaseCompMethods, ChessBoard */

(function(){

"use strict";

   var _doc = (document._currentScript || document.currentScript).ownerDocument;
   var _template = _doc.querySelector('template#vs-chess-template');

   var Proto = Object.create(HTMLElement.prototype, BaseCompMethods.propertiesObject);


  _.extend(Proto, {
      init: function() {
         this.reset();

         this.board.init( this );
         this.view.init( this );

         if ( this.config.exerciseType !== undefined && this.config.exerciseType !== null ) {
            this.state.exerciseType = this.config.exerciseType;
            this.state.exerciseCreated = true;
            this.state.recording = this.config.recording;

            this.view.buildDisplay( this.state.exerciseType );
         }
         else {
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
         function pieceMoved() {     
            var oldV, newV;
            if ( attrName === 'editable' ) return false;

            if ( oldVal === null && newVal === null ) {  
               return false;
            }
            else if ( oldVal === null && newVal.position === undefined ) { 
               return false;
            } else {
               oldV = JSON.parse(oldVal);  newV = JSON.parse(newVal);
               if ( oldV.position === undefined && newV.position === undefined ) return false;
               return ! ( oldV.position ===  newV.position );
            }
         }


         if ( this.state === undefined ) {
            this.state = { };
            this.init();
         }

         switch (attrName) {
            case 'editable':
               this.board.refresh();
               this.toggleAuthorLearner( this.editable );
               break;

            case 'data-config':
               if ( ! pieceMoved() ) {
                 this.board.refresh();
               }
               break;

            default:
               break;
         }
      }
   });



   _.extend(Proto, {
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

         refresh = function ( allowMovement ) {
            var onChange = function(oldPos, newPos) {
                  _oldPos = oldPos;
                  _newPos = newPos;

                  me.view.chessPieceMoveEvent( oldPos, newPos );                     
               };

            var cfg,
               position = _newPos || 'start';

            cfg = {
               draggable: ( allowMovement === undefined ) ? true : allowMovement,
               showNotation: (me.config && me.config.showNotation !== undefined ) ? me.config.showNotation : false,
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

      }(),
   });


   _.extend(Proto, {
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

               $mainControls.append( '<div id="section' + which + '" class="section"></div>' );

               obj.$el = $( '#section' + which );               
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
            },


            setTitle = function( str ) { $titleText.html( '<span class="title">' + str + '</span>'  ); },

            reset = function() {
               $resetBtn.hide();
            },


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


            makeButton = function( $el, fn  ) { 
               $el.on('mouseover mouseout click', function(e) {
                  if ( e.type === 'mouseover' ) {
                     // $(this).addClass('buttonOver1');
                  } 
                  else if ( e.type === 'mouseout' ) {
                     // $(this).removeClass('buttonOver1');
                  }
                  else if ( e.type === 'click' ) {
                     $(this)
                        .hide() 
                        .fadeIn( 175, function() { 
                           fn( $(this) );
                        });
                  }
               });
            },


            makeResetButton = function( $el ) {
               $el.off();
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

               $('body').on( 'keyup.statusMsg', function(e) {
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

            toggleAuthorLearner = function ( isAuthorMode ) {
               var markup,
                  fn;

               $mainControls.find('.author-only').css( 'display', ( isAuthorMode ? 'block' : 'none' ) );
               $resetBtn.css( 'visibility', ( isAuthorMode ? 'visible' : 'hidden' ) );

               if ( me.state.exerciseType === undefined ) return;

               if ( me.state.exerciseCreated ) {

                  switch ( me.state.exerciseType ) {
                     case 'Snapshot' :
                        if ( isAuthorMode ) {
                           _section1.$el.find( '#showSnapshot' ).remove();
                           _section2.$el.find( '.comment' ).remove();
                        }
                        else {
                           jumpToSnapshot();
                        }
                        break;

                     case 'Sequence' :
                        if ( isAuthorMode ) {
                           _section1.$el.find( '#topRow' ).css( 'display', 'inline-block' );
                           _section1.$el.find( '#record' ).show();
                        }
                        else {
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
                        } 
                        else {
                           if ( ! me.state.challengeStarted ) {
                              initChallenge();
                           }

                           me.board.setPosition( me.state.recording[0].pos );

                           markup = '<div id="learnerControls"> \
                                 <div id="try" class="buttonType1 spacing1 smallerPadding">try challenge</div>\
                              </div>';

                           if ( learnerControls.length === 0 ) {
                              _section1.$el.append( markup );

                              makeStdButton( _section1.$el.find( '#try' ), function( btn ) {
                                 me.board.setPosition( me.state.recording[0].pos ); 
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
               else {
                  switch ( me.state.exerciseType ) {
                     case 'Snapshot':
                        if ( isAuthorMode ) {

                        } else {
                        }

                     break;

                     case 'Sequence':
                        if ( me.state.recordingStarted && !me.state.recordingFinished ) {
                           stopRecording();
                        }
                     break;

                     case 'Challenge':
                     break;

                     default:
                     break;
                  }
               }


            },


            buildDisplay = function( exerciseType ) {
               var markup;

               makeResetButton( $resetBtn );

               setTitle( me.state.exerciseType );

               switch ( me.state.exerciseType ) {
                  case 'Snapshot':
                     markup = '<div id="" class="author-only"> \
                        <div id="capture" class="buttonType1 smallerPadding">capture</div>\
                        <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );
                     _section1.$el.css( 'height', '34px' );
                     makeStdButton( _section1.$el.find( '#capture' ), recordSnapshot, 'color-green', '171px' );
                     makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
                     makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Write a note or description about this position"></textarea>';
                     _section2.html( markup );
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

                     _section1.html( markup );
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
                     _section2.$el.find( '.lilButton' ).hide();
                     _section2.$el.css( 'height', '105px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Set board to start position, enter optional comment for start position here"></textarea>';
                     _section3.html( markup );
                     _section3.$el.css( 'height', '105px' );
                  
                    break;

                  case 'Challenge':
                     markup = '<div class="author-only"> \
                        <div id="set" class="buttonType1 smallerPadding">set challenge</div>\
                        <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                        <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
                     </div>';

                     _section1.html( markup );
                     _section1.$el.css( 'height', '34px' );
                     makeStdButton( _section1.$el.find( '#set' ), recordChallenge, 'color-green', '171px' );
                     makeStdButton( _section1.$el.find( '#reset' ), function() { me.board.resetToStart(); }, 'color-grey', '81px' );
                     makeStdButton( _section1.$el.find( '#clear' ), function() { me.board.clearAllPieces(); }, 'color-grey', '81px' );

                     markup = '<textarea id="commentEntry" class="textbox2 author-only" name="textarea" maxlength="310" placeholder="Enter instructions for your challenge here.\n\nTo create a challenge, set your initial position on the board, then click set challenge"></textarea>';
                     _section2.html( markup );
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


            recordSnapshot = function() {
               if ( me.state.exerciseCreated ) {
                  me.state.recording.pop();
               }

               me.state.recording.push( { pos: me.board.fen(), comment: $commentEntry.val().trim() } );
               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;

               _section1.$el.find( '#capture' ).text( 're-capture' );
               $notationDisplay.html( '<p class="highlight1">' + me.board.fen() + '</p>' );
            },


            recordSequence = function( button ) {
               button.off();
               button.text( 'stop' );

               if ( me.state.recordingFinished ) {
                  me.state.exerciseCreated = false;

                  _section2.$el.find( '.lilArrow' ).off().hide();
                  $notationDisplay.find('.move').removeClass('highlight2');
                  $notationDisplay.find('.move').last().addClass('highlight2');

                  var markup = '<textarea id="commentEntry" class="textbox author-only" name="textarea" maxlength="310" placeholder="Set board to start position and enter comment for it here"></textarea>';
                  _section3.html( markup );
                  _section3.$el.css( 'height', '105px' );
                  $commentEntry = _section3.$el.find( '#commentEntry' );

                  me.board.setPosition( me.state.recording[ me.state.recording.length - 1 ].pos  );
               }
               else {
                  me.state.recording.push({
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
               $commentEntry.val('');

               _section2.$el.find( '#eraseButton' ).off().show();

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
               button.one( 'click', stopRecording );
            },


            stopRecording = function() {   
               var button = _section1.$el.find( '#record' );
               button.text( 'record' );

               _section1.$el.find( '#play' ).show();
               _section2.$el.find( '#eraseButton' ).off().hide();

               $commentEntry.remove();
               _section3.$el.append( '<span class="comment">' + ( me.state.recording[ me.state.recording.length - 1 ].comment || " " )  + '</span>');  // put comment from last frame in new comment area

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;  

               readyToPlaySequence();

               makeButton( button, recordSequence );

               _section1.$el.find( '#reset' ).show();
               _section1.$el.find( '#clear' ).show();

               enableArrowButtons();
               enableClickOnFrame();
            },


            readyToPlaySequence = function( delay ) {
               var topRow = _section1.$el.find('#topRow'),
                  $thePlayButton,
                  setupPlayButton = function() {
                     makeStdButton( $thePlayButton, function() {
                        var i = 0,
                        timeoutID,
                        loopAndPause = function() {
                           var elt;
                           _section2.$el.find( '.move' ).removeClass( 'highlight2' );
                           _section2.$el.find( '#move' + i ).addClass( 'highlight2' );
                           me.board.setPosition( me.state.recording[i].pos );
                           _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[i].comment || " " ) + '</span>' );
                           if ( timeoutID ) window.clearTimeout( timeoutID );
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
                        _section2.$el.find( '.move' ).off();
                        _section2.$el.find( '.lilArrow').off();

                        _section1.$el.find( '#record' ).hide();
                        _section1.$el.find( '#reset' ).hide();                    
                        _section1.$el.find( '#clear' ).hide();

                        loopAndPause();
                     }, 'color-green', '81px' ); 
                  };

               if ( _section1.$el.find( '#play' ).length !== 0 ) {
                  return;
               }
               else {
                  _section1.$el.prepend( '<div id="play" class="buttonType1 smallerPadding">play</div>' );
                  _section1.$el.find( '#play').css( 'margin-right', '9px' );
                  $thePlayButton = _section1.$el.find( '#play' );
                  setupPlayButton();
               }
            },


            enableArrowButtons = function() {
               _section2.$el.find( '.lilArrow' ).show();

               _section2.$el.find( '.lilArrow' )       
                  .on( 'click', function(e) {
                     $(this).hide().fadeIn( 150, function() { 
                        var frame = $notationDisplay.find('.highlight2').text().trim();

                        frame = ( frame.slice(0, frame.indexOf('.')) ) * 1;      
                        if ( $(this).context.id === 'leftButton' )  {
                           if ( frame == 0 ) { return; }
                           $notationDisplay.find('.highlight2').removeClass('highlight2').prev().addClass('highlight2');
                           frame--;
                        }
                        else {
                           if ( frame == me.state.recording.length - 1 ) { return; }
                           $notationDisplay.find('.highlight2').removeClass('highlight2').next( ).addClass('highlight2');
                           frame++;
                        }
                        me.board.setPosition( me.state.recording[frame].pos );
                        _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[frame].comment || " " ) + '</span>' );
                     });
                  });
            },



            enableClickOnFrame = function() {
               _section2.$el.find('.move')
                  .addClass('cursor1')
                  .on( 'click', function(e) {
                     var frame = $(e.target).text().trim();

                     _section2.$el.find('.move').removeClass('highlight2');
                     $(e.target).addClass('highlight2');
                     frame = frame.slice(0, frame.indexOf('.'));
                     me.board.setPosition( me.state.recording[frame].pos );
                     _section3.$el.empty().append( '<span class="comment">' + ( me.state.recording[frame].comment || " " ) + '</span>' );
               });
            },


            initChallenge = function() {
               var challenges = [{
                     answers: me.state.recording[1].pos,
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
                        me.board.setPosition( me.state.recording[0].pos );                               
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

               if (  me.state.recordingFinished ) {
               } 
               else {
                  me.state.recording.push({
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


            stopRecordingChallenge = function() {
               var markup = '<div class="author-only"> \
                  <div id="set" class="buttonType1 smallerPadding">reset challenge</div>\
                  <div id="reset" class="buttonType1 fontSize13 spacing1">reset pieces</div>\
                  <div id="clear" class="buttonType1 fontSize13 spacing1">clear board</div>\
               </div>';

               me.persistToVSPlayer( { exerciseType: me.state.exerciseType, recording: me.state.recording } );
               me.state.exerciseCreated = true;
               me.state.recordingFinished = true;

               _section1.html( markup );
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

               _section3.$el.find( '.author-only' ).removeClass( 'author-only');
            },



            
            objectDiff = function ( a, b ) {
               var result = {};
               for (var i in b) {
                  if ( a[i] !== b[i] ) {
                     result[i] = b[i];
                  }
               }
               return JSON.stringify(result).replace(/[^\w\s]/gi, '');   
            },


            generateDiffList = function( moveDetail ) {
               var i, 
               moves = '<p id="movements" class="challengeAuthorOnly"><span id="move0" class="move chicklet1 rounded ">0.start</span>';

               for ( i = 1; i < me.state.recording.length; i++ ) {
                  moves += ( '   <span id="move' + i + '" class="move chicklet1 rounded ' );
                  if ( me.state.exerciseType === 'Challenge' ) moves += 'chicklet2 ';
                  if ( i === me.state.recording.length - 1 ) {
                     moves += ( 'highlight2">    ' + i + '.' + moveDetail );
                  } else {
                     moves += ( '">    ' + i + '.' + me.state.recording[i].delta );
                  }
                  if ( ( (i+1) % 5 === 0) ) moves += '\n';
                  moves += '</span>';

               }
               moves += '</p></span>';

               return moves;
            },


            handleChessPieceMoveEvent = function( oldPos, newPos ) {
               var markup;
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

               var lastDiff;

               if ( me.state.recordingStarted && !me.state.recordingFinished && !me.state.isDeleting) {
                  lastDiff = objectDiff( oldPos, newPos );

                  me.state.recording.push({ 
                     pos: newPos,
                     comment: $commentEntry.val().trim(),
                     delta: lastDiff
                  });

                  $commentEntry.val('');
                  
                  if ( me.state.exerciseType === 'Challenge' ) {
                     $notationDisplay
                        .empty()
                        .append( '<span class="challengeAuthorOnly"></span>')
                        .append( generateDiffList( lastDiff ) );
                     stopRecordingChallenge();
                  }
                  else {
                     $commentEntry.attr( 'placeholder', 'Enter optional note for step ' + me.state.recording.length );                  
                     $notationDisplay.html( generateDiffList( lastDiff ) );
                  }                
               }

               if ( me.state.isDeleting ) me.state.isDeleting = false;

               if ( me.state.challengeStarted && ! me.state.challengeFinished && me.state.exerciseType === 'Challenge' && !me.editable ) {
                  me.state.challengeFinished = true;
                  lastDiff = objectDiff( oldPos, newPos );
                  $notationDisplay.empty().append( generateDiffList( lastDiff ) );
                  me.state.challengesApi.scoreChallenges( [ newPos ] ); 
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
      }()
   });


   _.extend(Proto, BaseCompMethods);

   document.registerElement('vs-chess', {
      prototype: Proto
   });

}());
