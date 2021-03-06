"use strict";

/**
 * state.js adds a general state management and API for other plugins
 *
 * Events that maybe subscribed to:
 *  - state:connnew: new connection, sends ucid
 *  - state:connleave: leaving connection, sends ucid
 *  - state:connren: connection rename, sends ucid
 *  - state:plyrnew: new player, sends plid
 *  - state:plyrleave: player leaves race, sends plid
 *  - state:plyrswap: 2 connections swap (player take over), sends plid
 *  - state:plyrupdate: player change (pits/unpits/position), sends array of plids
 *  - state:oos: if you subscribe to this event you MUST check whether or not you
 *               should handle it based on the last state:oos. for simplicity use
 *               state.handleOOS() to determime this
 *  - state:track: new or changed track or layout
 *  - state:best: new fastest/best lap, plid and time can be gotten from
 *                state.best.plid and state.best.time
 *  - state:wind: changed wind conditions
 *  - state:weather: changed weather conditions
 *  - state:server: joins/leaves server, argument passed to call back is true on
 *                  join, false on leave
 *  - state:race: new race
 *
 *
 * i.e. in your dependent plugin:
 * this.on('state:connnew', function(ucid)
 * {
 *     var conn = this.state.getConnByUcid(ucid);
 *
 *     console.log('New connection %d - %s', ucid, conn.uname);
 * });
 */

var utils = require('util'),
	events = require('events');

var StateBase = function() {};

StateBase.prototype = {
	'fromPkt': function(pkt)
	{
		var props = pkt.getProperties();

		for (var i in props)
		{
			var propK = props[i];
			var propV = pkt[propK];

			if ((typeof propV != 'function') && (this[i] !== 'undefined'))
				this[propK] = propV;
		}
	}
};

var ConnState = function(pkt)
{
	var self = this;

	self.ucid = 0;
	self.admin = false;
	self.uname = '';
	self.flags = 0;

	self.plid = 0;

	// setup, from IS_NCN
	if (pkt)
		self.fromPkt(pkt);
}

utils.inherits(ConnState, StateBase);

var PlyrState = function(pkt)
{
	var self = this;

	self.plid = 0;

	self.ucid = 0;
	self.ptype = 0;
	self.flags = 0;

	self.pname = '';
	self.plate = '';
	self.cname = '';
	self.sname = '';
	self.tyres = 0;
	
	self.h_mass = 0;
	self.h_tres = 0;
	self.model = 0;
	self.pass = 0;
	self.setf = 0;
	self.pitting = false; // tele-pitting
	self.pitstop = false; // normal pit - i.e. in game

	self.node = 0;
	self.lap = 0;
	self.position = 0;
	self.position_original = 0; // starting position
	self.info = 0;
	self.x = 0;
	self.y = 0;
	self.z = 0;
	self.speed = 0;
	self.direction = 0;
	self.heading = 0;
	self.angvel = 0;

	self.ttime = 0;
	self.btime = 0;
	self.numstops = 0;

	// array of pit stops
	self.pitstops = [];

	self.lapsdone = 0;
	self.resultnum = 0;
	self.pseconds = 0;

	self.penalty = 0; // current penalty, if any
	self.ltime = 0;
	self.btime = 0;
	self.etime = 0;
	self.stime = 0;

	self.finalresult = false; // is the final result
	self.finished = true; // finished, but not final result

	// setup from IS_NPL
	if (pkt)
		this.fromPkt(pkt);
}

utils.inherits(PlyrState, StateBase);

var ClientState = function(options)
{
	this.reset();
}

ClientState.prototype = {
	'associate': function(client)
	{
		var self = this;

		client.log.info('Registering state plugin');
		client.options.isiflags |= client.insim.ISF_MCI;

		self.registerHooks(client);
		client.state = self;

		client.on('preconnect', function()
		{
			this.emit('state:ready');
		});

		client.on('disconnect', function()
		{
			this.emit('state:notready');
			self.reset();
		});
	},
	'reset': function()
	{
		this.lfs = {
			'version': '', // lfs version
			'product': '', // lfs product name (Demo, S1, S2)
			'insimver': 5 // insim version
		};

		this.host = false; // is host?
		this.hname = ''; // hostname

		this.replayspeed = 1;
		this.flags = 0; // state flags
		this.ingamecam = 0;
		this.viewplid = 0; // currently viewing this plid

		this.raceinprog = 0; // 0 = no race, 1 = race, 2 = qualifying
		this.qualmins = 0; // number of qualifying mins
		this.racelaps = 0; // laps

		this.track = ''; // short trackname
		this.weather = ''; // 0-2
		this.wind = ''; // 0-2, none-weak-strong

		this.axstart = 0; // ax start node
		this.numcp = 0; // number of cps
		this.numo = 0; // number of objects
		this.lname = ''; // layout name, if any
		this.nump = 0; // number of players

		this.conns = [];
		this.plyrs = [];

		this._initBest();

		this.lastOOS = (new Date).getTime()-10000;
	},
	// helper functions
	'_initBest': function()
	{
		var self = this;
		self.best = {
			'plid': null,
			'time': 0
		};
	},
	'getPlyrByPlid': function(plid)
	{
		var self = this;

		return self.plyrs[plid];
	},
	'getPlyrByUcid': function(ucid)
	{
		var self = this;

		if (!self.conns[ucid])
			return;

		return self.plyrs[self.conns[ucid].plid];
	},
	'getConnByUcid': function(ucid)
	{
		var self = this;

		return self.conns[ucid];
	},
	'getConnByPlid': function(plid)
	{
		var self = this;

		if (!self.plyrs[plid])
			return;

		return self.conns[self.plyrs[plid].ucid];
	},

	'handleOOS': function()
	{
		// if you decide to use state:oos you MUST use this function to prevent
		// horrible loops of requests from occuring

		var now = (new Date).getTime();

		// prevent too many OOS'
		if ((now - this.lastOOS) <= 10000)
			return false;

		this.lastOOS = now;	

		return true;
	},

	// request the current state from LFS
	'requestCurrentState': function()
	{
		var self = this.state;

		if (!self.handleOOS())
		{
			this.log.debug('OOS - Ignoring, <= 10s since last OOS');
			return;
		}

		this.log.debug('OOS - Requesting data');

		// FIXME in a loop sending these 4 pkts breaks horribly..
		// TODO figure out why
		var t0 = new this.insim.IS_TINY();
		t0.reqi = 1;
		t0.subt = this.insim.TINY_ISM;
		this.send(t0);

		var t1 = new this.insim.IS_TINY();
		t1.reqi = 1;
		t1.subt = this.insim.TINY_NCN;
		this.send(t1);

		var t2 = new this.insim.IS_TINY();
		t2.reqi = 1;
		t2.subt = this.insim.TINY_NPL;
		this.send(t2);

		var t3 = new this.insim.IS_TINY();
		t3.reqi = 1;
		t3.subt = this.insim.TINY_SST;
		this.send(t3);

		var t4 = new this.insim.IS_TINY();
		t4.reqi = 1;
		t4.subt = this.insim.TINY_AXI;
		this.send(t4);
	},

	// state ready
	'onIS_VER': function(pkt)
	{
		var self = this.state;

		self.lfs.version = pkt.version;
		self.lfs.product = pkt.product;
		self.lfs.insimver = pkt.insimver;

		this.emit('state:oos');
	},

	// game state
	// used by IS_STA IS_RST and IS_AXI
	'onGeneric_Copy': function(pkt)
	{
		var self = this.state;

		// useful function that can be used when we just need to copy
		// game state change or race start
		// we just blindly copy 
		var props = pkt.getProperties();

		for (var i in props)
		{
			var propK = props[i];
			var propV = pkt[propK];

			if ((typeof propV != 'function') && (self[i] !== 'undefined'))
				self[propK] = propV;
		}
	},
	'onIS_STA': function(pkt)
	{
		var self = this.state;

		//  state change
		var ctrack = self.track,
			weather = self.weather,
			wind = self.wind;
		
		self.onGeneric_Copy.call(this, pkt);

		if (ctrack != self.track)
			this.emit('state:track');

		if (weather != self.weather)
			this.emit('state:weather');

		if (wind != self.wind)
			this.emit('state:wind');
	},
	'onIS_AXI': function(pkt)
	{
		var self = this.state;

		//  state change
		var lname = self.lname;
		
		self.onGeneric_Copy.call(this, pkt);

		if (lname != self.lname)
			this.emit('state:layout');
	},
	'onIS_ISM': function(pkt)
	{
		var self = this.state;

		//  multiplayer start/join
		
		self.host = pkt.host;
		self.hname = pkt.hname;

		this.emit('state:oos');

		this.emit('state:server', true);
	},
	'onIS_TINY': function(pkt)
	{
		var self = this.state;

		if (pkt.subt == this.insim.TINY_MPE)
		{
			self.host = 0;
			self.hname = '';

			this.emit('state:server', false);
			return;
		}

		if (pkt.subt == this.insim.TINY_AXC)
		{
			self.onGeneric_Copy.call(this, pkt);
			this.state.lname = '';

			this.emit('state:track');
			return;
		}
	},
	'onIS_RST': function(pkt)
	{
		var self = this.state;

		//  multiplayer start/join
		var ctrack = self.track;
		
		self.onGeneric_Copy.call(this, pkt);

		self._initBest();
		
		for (var i in self.plyrs)
		{
			var p = self.plyrs[i];
			if (!p)
				continue;

			p.ttime = 0;
			p.ltime = 0;
			p.btime = 0;
			p.etime = 0;
			p.numstops = 0;
			p.lapsdone = 0;
			p.resultnum = 0;
			p.pseconds = 0;
			p.penalty = 0;
			p.finalresult = false;
			p.pitstops = [];
			p.finished = false;
			p.position_original = 0;
		}

		if (ctrack != self.track)
			this.emit('state:track');

		this.emit('state:race');
		this.emit('state:racestart');
	},

	// connection specific hooks
	'onIS_NCN': function(pkt)
	{
		var self = this.state;
		// new connection

		var c = new ConnState(pkt);
		self.conns[c.ucid] = c;

		this.emit('state:connnew', c.ucid);
	},
	'onIS_CNL': function(pkt)
	{
		var self = this.state;
		// connection leaves

		if (!self.conns[pkt.ucid])
			return;

		this.emit('state:connleave:pre', pkt.ucid);
		
		if ((self.conns[pkt.ucid].plid > 0) && (self.plyrs[self.conns[pkt.ucid].plid]))
			delete self.plyrs[self.conns[pkt.ucid].plid];

		delete self.conns[pkt.ucid];

		this.emit('state:connleave', pkt.ucid);
	},
	'onIS_CPR': function(pkt)
	{
		var self = this.state;
		// connection rename

		if (!self.conns[pkt.ucid])
			return;

		self.conns[pkt.ucid].pname = pkt.pname;
		self.conns[pkt.ucid].plate = pkt.plate;

		this.emit('state:connren', pkt.ucid);
	},

	// player specific hooks
	'onIS_NPL': function(pkt)
	{
		var self = this.state;
		var p = null;
		var n = false;
		
		if (!self.plyrs[pkt.plid])
		{
			// new/unknown plyr
			p = new PlyrState(pkt);
			self.plyrs[p.plid] = p;
			n = true;
		}
		else
		{
			// existing, un-pitting plyr, update our info
			p = self.plyrs[pkt.plid];
			p.fromPkt(pkt);
			p.pitting = false;
		}

		if (self.conns[p.ucid])
			self.conns[p.ucid].plid = p.plid;

		if (n)
			this.emit('state:plyrnew', pkt.plid);
		else
			this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_PIT': function(pkt)
	{
		var self = this.state;
		// player pit stop starts (not tele-pit)

		if (!self.plyrs[pkt.plid])
			return;

		self.plyrs[pkt.plid].pitstop = true;
		self.plyrs[pkt.plid].tyres = pkt.tyres;
		self.plyrs[pkt.plid].numstops = pkt.numstops;
		self.plyrs[pkt.plid].lapsdone = pkt.lapsdone;

		// emit our custom event
		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_PSF': function(pkt)
	{
		var self = this.state;
		// player pit stop finished (not tele-pit)

		if (!self.plyrs[pkt.plid])
			return;

		self.plyrs[pkt.plid].pitstop = false;

		self.plyrs[pkt.plid].pitstops.push({
			'lap': self.plyrs[pkt.plid].lapsdone,
			'time': pkt.stime
		});

		// emit our custom event
		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_PLP': function(pkt)
	{
		var self = this.state;
		// player tele-pits

		if (!self.plyrs[pkt.plid])
			return;

		self.plyrs[pkt.plid].pitting = true;
		self.plyrs[pkt.plid].position_original = 0;

		// emit our custom event
		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_PLL': function(pkt)
	{
		var self = this.state;

		// player leaves
		if (!self.plyrs[pkt.plid])
		{
			// out of sync, lets get sync
			this.emit('state:oos');
			return; 
		}

		this.emit('state:plyrleave:pre', pkt.ucid);

		var ucid = self.plyrs[pkt.plid].ucid;
		delete self.plyrs[pkt.plid];

		if ((ucid > 0) && (self.conns[ucid]))
			self.conns[ucid].plid = 0; // out of sync if this doesn't happen

		this.emit('state:plyrleave', pkt.plid);
	},
	'onIS_TOC': function(pkt)
	{
		var self = this.state;

		// player takes over vehicle (connection->player swapping)
		if ((!self.plyrs[pkt.plid]) || (self.plyrs[pkt.plid].ucid != pkt.olducid))
		{
			// out of sync, lets get sync
			this.log.crit('plyrs out of sync');
			this.emit('state:oos');
			return;
		}

		self.plyrs[pkt.plid].ucid = pkt.newucid;
		self.conns[pkt.newucid].plid = pkt.plid;
		self.conns[pkt.olducid].plid = 0;

		this.emit('state:plyrswap', pkt.plid);
	},
	'onIS_FIN': function(pkt)
	{
		var self = this.state;
		// player finish notification
		// not final result

		if (!self.plyrs[pkt.plid])
			return;

		self.plyrs[pkt.plid].fromPkt(pkt);
		self.plyrs[pkt.plid].finished = true;
		self.plyrs[pkt.plid].finalresult = false;

		// emit our custom event
		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_LAPSPX': function(pkt)
	{
		var self = this.state;

		if (!self.plyrs[pkt.plid])
		{
			// out of sync, lets get sync
			this.emit('state:oos');
			return; 
		}

		self.plyrs[pkt.plid].fromPkt(pkt);

		if (pkt.ltime > 0)
		{
			if (self.plyrs[pkt.plid].btime <= 0)
				self.plyrs[pkt.plid].btime = pkt.ltime;

			if (pkt.ltime < self.plyrs[pkt.plid].btime)
				self.plyrs[pkt.plid].btime = pkt.ltime;

			if ((self.best.time <= 0) || (pkt.ltime < self.best.time))
			{
				// new best lap
				self.best.time = pkt.ltime; 
				self.best.plid = pkt.plid;
				this.emit('state:best');
			}
		}

		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_RES': function(pkt)
	{
		var self = this.state;
		// player finish result
		// final result

		if (!self.plyrs[pkt.plid])
			return;

		self.plyrs[pkt.plid].fromPkt(pkt);
		self.plyrs[pkt.plid].finished = true;
		self.plyrs[pkt.plid].finalresult = true;

		// emit our custom event
		this.emit('state:plyrupdate', [ pkt.plid ]);
	},
	'onIS_MCI': function(pkt)
	{
		var self = this.state;

		var updated = [];

		// positioning update
		for(var i in pkt.compcar)
		{
			var p = pkt.compcar[i];

			if (!self.plyrs[p.plid])
			{
				// out of sync, lets get sync
				this.emit('state:oos');
				continue; 
			}

			self.plyrs[p.plid].fromPkt(p);

			if (self.plyrs[p.plid].position_original == 0)
				self.plyrs[p.plid].position_original = p.position;

			updated.push(p.plid);
		}

		// emit our custom event
		this.emit('state:plyrupdate', updated);
	},
	// Reordered track
	'onIS_REO': function(pkt)
	{
		var self = this.state;

		self.nump = pkt.nump;

		for (var i = 0; i < pkt.plid.length; i++)
		{
			// once we reach 0's, there should be no more players
			if (pkt.plid[i] <= 0)
				return;

			var plid = pkt.plid[i];

			if (!self.plyrs[plid])
			{
				// out of sync, lets get sync
				this.emit('state:oos');
				continue; 
			}

			self.plyrs[plid].position_original = i + 1;
		}
	},

	// hooks, helper array
	'hooks': {
		'state:oos': 'requestCurrentState',

		'IS_VER': 'onIS_VER',
		'IS_TINY': 'onIS_TINY',

		'IS_STA': 'onIS_STA',
		'IS_RST': 'onIS_RST',
		'IS_AXI': 'onIS_AXI',
		'IS_ISM': 'onIS_ISM',

		'IS_NCN': 'onIS_NCN',
		'IS_CNL': 'onIS_CNL',
		'IS_CPR': 'onIS_CPR',

		'IS_NPL': 'onIS_NPL',
		'IS_PIT': 'onIS_PIT',
		'IS_PSF': 'onIS_PSF',
		'IS_PLP': 'onIS_PLP',
		'IS_PLL': 'onIS_PLL',
		'IS_TOC': 'onIS_TOC',
		'IS_FIN': 'onIS_FIN',
		'IS_RES': 'onIS_RES',
		'IS_LAP': 'onIS_LAPSPX',
		'IS_SPX': 'onIS_LAPSPX',
		'IS_MCI': 'onIS_MCI',
		'IS_REO': 'onIS_REO'
	},

	// hook helpers
	'registerHooks': function(client)
	{
		var self = this;

		// register all hooks
		for (var i in self.hooks)
			client.on(i, self[self.hooks[i]]);
	},
	'unregisterHooks': function(client)
	{
		var self = this;

		// unregister all hooks
		for (var i in self.hooks)
			client.off(i, self[self.hooks[i]]);
	}
};

module.exports = ClientState;
