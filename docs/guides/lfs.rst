Installing and Configuring LFS
==============================

Dedicated Server
----------------

Installing & Running
^^^^^^^^^^^^^^^^^^^^

1. Download the Dedicated Host from `LFS.net Additional Downloads`_.

2. Extract to somewhere non-temporary on your file system.

3. Consult readme.txt in the directory you just extracted for details on how to
   configure and run the dedicated server.

.. HINT::
    Whilst there is only a Windows binary provided for LFS dedicated hosting, it
    is possible and commonly used on Linux, BSD, Solaris and Mac OS X, under `Wine`_.
    I won't go through the exact details, however there is a handy wiki page on
    `_LFS Manual - Hosting`.

Configuring Insim
^^^^^^^^^^^^^^^^^

1. Open your dedicated server applicable cfg file, and set `/insim 29999`. Then
   save. Make a note of your `/admin` value. Insim uses this password to
   connect.

2. Restart your LFS dedicated server.

.. HINT::
    A double forward slash (`//`) at the start of a line in the LFS
    configuration file denotes a **comment**. This means that line is ignored.
    If you want the line to be acted on by LFS it **must** only have one slash.

Configuring Outsim
^^^^^^^^^^^^^^^^^^

You can't for a dedicated server. Outsim is client side only.

Configuring Outgauge
^^^^^^^^^^^^^^^^^^^^

You can't for a dedicated server. Outgauge is client side only.

Client
------

Installing
^^^^^^^^^^

I won't go through LFS in great detail. If you're here then you should alreaady
know what LFS is, and how to install it.

That said, here are the basics:

1. You'll need an account on `LFS.net`_.

   ..ATTENTION::
   You'll need to setup both a WEB password and a GAME password.
   The WEB password is used to logon to various LFS websites, including forums,
   account website and LFS World.
   The GAME password is used to unlock your LFS client - sort of like entering a
   license key it determines what content you're permitted.

2. Download and run the installer from `LFS.net`_

3. Run LFS. 

4. It should now ask you to unlock LFS. Do so using the account name and GAME
   password you setup on `LFS.net`_.

Configuring Insim
^^^^^^^^^^^^^^^^^

1. With the game running you can press `t` to open a chat dialog box. 

2. Type `/insim 29999`. This starts Insim on port 29999. If you receive a `bind
   failed` error message you will need to use a different port. Remember this
   port number as you will need to config xi4n to use it later.

3. Each time you start LFS you will need to re-perform steps 1 and 2.

.. HINT::
    You can actually call ``LFS.exe`` with various arguments, including the one
    to start Insim. This allows you to create a custom shortcut that auto-starts
    Insim everytime you start LFS. For example: ``LFS.exe /insim 29999``.
    You could even go a step further and create a script that starts LFS first
    then starts xi4n. You're on your own to figure that out, although it's not
    tricky.

Configuring Outsim
^^^^^^^^^^^^^^^^^^

Outsim can be started one of two ways. Either via Insim, which your Insim
program must know to do, or via `cfg.txt` which can be found in your LFS
installation directory.

.. HINT::
    If you want to use Insim at the same time as Outsim, then you probably want
    to setup Outsim via Insim rather than via `cfg.txt` as you will get both
    sets of packets from a single connection, rather than on 2 different
    connections - which will make writing custom plugins much, much easier.
    However, if you only want Outsim, then there is nothing wrong with using
    either.

To enable Outsim via `cfg.txt` edit it so that it has the following lines (you
may want to substitute a different port).

``Outsim Mode 1        // 0=off 1=driving 2=driving+replay
Outsim Delay 1       // Minimum delay between packets (100ths of a sec)
Outsim IP 0.0.0.0    // IP address to send the UDP packet
Outsim Port 29998    // IP port
Outsim ID 0          // If not zero, adds an identifier to the packet``

Configuring Outgauge
^^^^^^^^^^^^^^^^^^^^

Outgauge can be started one of two ways. Either via Insim, which your Insim
program must know to do, or via `cfg.txt` which can be found in your LFS
installation directory.

.. HINT::
    If you want to use Insim at the same time as Outgauge, then you probably want
    to setup Outgauge via Insim rather than via `cfg.txt` as you will get both
    sets of packets from a single connection, rather than on 2 different
    connections - which will make writing custom plugins much, much easier.
    However, if you only want Outgauge, then there is nothing wrong with using
    either.

To enable Outsim via `cfg.txt` edit it so that it has the following lines (you
may want to substitute a different port).

``Outgauge Mode 1        // 0-off 1-driving 2-driving+replay
Outgauge Delay 1       // minimum delay between packets (100ths of a sec)
Outgauge IP 0.0.0.0    // IP address to send the UDP packet
Outgauge Port 0        // IP port
Outgauge ID 0          // if not zero, adds an identifier to the packet``

.. _LFS.net: http://www.lfs.net/
.. _LFS.net Additional Downloads: http://www.lfs.net/?page=addons
.. _Wine: http://www.winehq.org/
.. _LFS Manual - Hosting: http://en.lfsmanual.net/wiki/Hosting

