var path = require('path'),
	fs = require('fs-extra');

module.exports = function(target)
{
	// create base plugins directory
	fs.mkdirpSync(path.join(target, 'plugins'));

	var boilerplate = [
		'config.yaml',
		'package.json',
		'README.html'
	];
	
	for (var i in boilerplate)
		fs.copy(path.join(__dirname, 'boilerplate', boilerplate[i]), path.join(target, boilerplate[i]), function(err)
		{
			if (err)
			{
				console.error();
				console.error('  failed to copy boilerplate file, technical details below:');
				console.lerr(err);
				console.error();
			}
		});

	process.on('exit', function()
	{
		console.log();
		console.log('  now what? go to \'%s\', and open README.html', target);
		console.log();
	});
}
