/*jslint node: true */
'use strict';
var moment = require('moment-timezone');
var request = require('request');
var express = require('express');
var app = express();
var expressHbs = require('express-handlebars');
var swag = require('swag');

runApp();

function runApp() {

  var gameList = { nba: [], mlb: [] };
  var gameListInstant = { nba: 0, mlb: 0 };
  var CACHE_INTERVAL = 10 * 60 * 1000;  // 10 minutes

  var handlebarsInstance = expressHbs.create(
    { 
      extname: 'hbs',
      defaultLayout: 'main.hbs'
    } );

  swag.registerHelpers( handlebarsInstance.handlebars );

  app.engine('hbs', handlebarsInstance.engine );
  app.set('view engine', 'hbs');

  app.use('/scores/mlb/css', express.static( __dirname + '/css' ) );
  app.use('/scores/mlb/js', express.static( __dirname + '/js' ) );
  app.use('/scores/mlb/images', express.static( __dirname + '/images/mlb' ) );

  app.use('/scores/nba/css', express.static( __dirname + '/css' ) );
  app.use('/scores/nba/js', express.static( __dirname + '/js' ) );
  app.use('/scores/nba/images', express.static( __dirname + '/images/nba' ) );

  app.get('/scores/mlb/', function(req, res){
    getMLBGames(
      function( games ) {
        res.render('scoreboard', { layout: 'mlb', games: games } );
      },
      function() {
        res.status( 500 );
        res.sendFile('500.html', {root: '.'});
      }
    );
  });

  app.get('/scores/mlb.json', function(req, res){
    getMLBGames(
      function( games ) {
        res.status( 200 );
        res.send( JSON.stringify( games ) );
      },
      function() {
        res.status( 500 );
        res.sendFile('500.html', {root: '.'});
      }
    );
  });

  app.get('/scores/nba/', function(req, res){
    getNBAGames(
      function( games ) {
        res.render('scoreboard', { layout: 'nba', games: games } );
      },
      function() {
        res.status( 500 );
        res.sendFile('500.html', {root: '.'});
      }
    );
  });

  app.get('/scores/nba.json', function(req, res){
    getNBAGames(
      function( games ) {
        res.status( 200 );
        res.send( JSON.stringify( games ) );
      },
      function() {
        res.status( 500 );
        res.sendFile('500.html', {root: '.'});
      }
    );
  });

  /*app.use(function(error, req, res, next) {
    res.status( 500 );
    res.sendFile('500.html', {root: '.'});
  });*/

  app.listen(8887);

  function getMLBGames( onSuccess, onError ) {
    getGames('mlb', onSuccess, onError );
  }

  function getNBAGames( onSuccess, onError ) {
    getGames('nba', onSuccess, onError );
  }

  function getGames( sport, onSuccess, onError ) {

    if ( gameList[ sport ].length > 0 && (new Date() - gameListInstant[ sport ] < CACHE_INTERVAL ) ) {
      getGamesFromList();
    }
    else {
      request( 'http://api.thescore.com/' + sport + '/schedule?utc_offset=-18000', gotSchedule);
    }

    function gotSchedule( error, response, body ) {
      try {
        var schedule = JSON.parse( body );
        gameList[ sport ] = schedule.current_group.event_ids;
        gameListInstant[ sport ] = new Date();
        getGamesFromList();
      }
      catch( e ) {
        onError();
      }
    }

    function getGamesFromList() {
      request( 'http://api.thescore.com/' + sport + '/events?id.in=' + gameList[ sport ].join('%2C'), gotGames );
    }

    function gotGames( error, response, body ) {
      try {
        var games = JSON.parse( body );
        for ( var i = 0; i < games.length; i++ ) {
          var game = games[ i ];
          if ( game.status === 'pre_game' ) {
            game.game_status = moment( new Date( game.game_date ) ).tz('America/Chicago').format('h:mm A');
          }
          else {
            game.game_status = game.box_score.progress.string;
          }
        }
        games.sort( function(a,b) {
          if ( a.status !== 'postponed' && b.status === 'postponed' ) {
            return -1;
          }
          if ( a.status === 'postponed' && b.status !== 'postponed' ) {
            return 1;
          }
          if ( a.status !== 'final' && b.status === 'final' ) {
            return -1;
          }
          if ( a.status === 'final' && b.status !== 'final' ) {
            return 1;
          }
          var a_moment = moment( new Date( a.game_date ) );
          var b_moment = moment( new Date( b.game_date ) );
          return a_moment.diff( b_moment );
        });
        onSuccess( games );
      }
      catch( e ) {
        onError();
      }
    }
  }
}
