"use strict";

var plugin = function(options)
{
}

plugin.prototype.associate = function(client)
{
	client.log.info('Registering poweredby plugin');

	client.on('IS_NCN', function(pkt)
	{
		if (pkt.ucid <= 0)
			return;

		var welcome = new this.insim.IS_MTC;
		welcome.ucid = pkt.ucid;
		welcome.text = 'This server is powered by ' + this.product.full;

		this.send(welcome);
	});
}

module.exports = plugin;
