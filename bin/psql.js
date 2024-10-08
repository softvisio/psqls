#!/usr/bin/env node
// vim: ft=javascript

import childProcess from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import stream from "node:stream";
import tls from "node:tls";

const SOCKET_KEEP_ALIVE_TIMEOUT = 60_000;

process.on( "SIGINT", () => {} );

var psql = "/usr/bin/psql",
    args = [],
    localHostname = "127.0.0.1",
    localPort,
    remoteHostname = process.env.PGHOST,
    remotePort = process.env.PGPORT || "5432",
    remoteUsername = process.env.PGUSER || process.env.USER,
    remoteDatabase,
    remoteSocket,
    proc;

const connectRemote = parseArgv();

remoteDatabase ||= remoteUsername;

if ( connectRemote && remoteHostname && !net.isIP( remoteHostname ) ) {
    remoteSocket = await connect();
}

if ( remoteSocket ) {
    const server = await new Promise( resolve => {
        const server = new net.Server();

        server.once( "listening", () => {
            localPort = server.address().port;

            resolve( server );
        } );

        server.listen( null, "127.0.0.1" );
    } );

    server.on( "connection", async localSocket => {
        localSocket.setKeepAlive( true, SOCKET_KEEP_ALIVE_TIMEOUT );

        if ( !remoteSocket ) {
            remoteSocket = await connect();

            if ( !remoteSocket ) process.exit( 1 );
        }

        stream.pipeline( localSocket, remoteSocket, () => {} );
        stream.pipeline( remoteSocket, localSocket, () => {} );

        remoteSocket = null;
    } );

    args.push( "--host", localHostname );
    args.push( "--port", localPort );
    args.push( "--username", remoteUsername );
    if ( remoteDatabase !== remoteUsername ) args.push( "--dbname", remoteDatabase );
    args.push( "--set", `REAL_HOST=${ remoteHostname }` );

    parsePgpass();

    proc = childProcess.spawn( psql, args, {
        "stdio": "inherit",
    } );
}
else {
    proc = childProcess.spawn( psql, process.argv.slice( 2 ), {
        "stdio": "inherit",
    } );
}

proc.on( "exit", code => process.exit( code ) );

function parseArgv () {
    const argv = process.argv.slice( 2 );

    for ( let n = 0; n < argv.length; n++ ) {
        const arg = argv[ n ];

        // help, version
        if ( arg === "-?" || arg.startsWith( "--help" ) || arg === "-V" || arg === "--version" ) return;

        if ( arg === "-h" || arg === "--host" ) {
            remoteHostname = argv[ n + 1 ];

            n++;
        }
        else if ( arg === "-p" || arg === "--port" ) {
            remotePort = argv[ n + 1 ];

            n++;
        }
        else if ( arg === "-U" || arg === "--username" ) {
            remoteUsername = argv[ n + 1 ];

            n++;
        }
        else if ( arg === "-d" || arg === "--dbname" ) {
            remoteDatabase = argv[ n + 1 ];

            n++;
        }

        // equation
        else if ( arg.startsWith( "-h=" ) ) {
            remoteHostname = arg.slice( 3 );
        }
        else if ( arg.startsWith( "--host=" ) ) {
            remoteHostname = arg.slice( 7 );
        }
        else if ( arg.startsWith( "-p=" ) ) {
            remotePort = arg.slice( 3 );
        }
        else if ( arg.startsWith( "--port=" ) ) {
            remotePort = arg.slice( 7 );
        }
        else if ( arg.startsWith( "-U=" ) ) {
            remoteUsername = arg.slice( 3 );
        }
        else if ( arg.startsWith( "--username=" ) ) {
            remoteUsername = arg.slice( 11 );
        }
        else if ( arg.startsWith( "-d=" ) ) {
            remoteDatabase = arg.slice( 3 );
        }
        else if ( arg.startsWith( "--database=" ) ) {
            remoteDatabase = arg.slice( 11 );
        }
        else {
            args.push( arg );
        }
    }

    return true;
}

function parsePgpass () {
    if ( process.env.PGPASSWORD ) return;

    if ( !fs.existsSync( process.env.HOME + "/.pgpass" ) ) return;

    const pgpass = fs.readFileSync( process.env.HOME + "/.pgpass", "latin1" ).split( "\n" );

    for ( let line of pgpass ) {
        line = line.trim();

        if ( !line || line.startsWith( "#" ) ) continue;

        const [ hostname, port, database, username, password ] = line.split( ":" );

        if ( hostname !== "*" && hostname !== remoteHostname ) continue;
        if ( port !== "*" && port !== remotePort ) continue;
        if ( database !== "*" && database !== remoteDatabase ) continue;
        if ( username !== "*" && username !== remoteUsername ) continue;

        process.env.PGPASSWORD = password;

        return;
    }
}

async function connect () {
    return new Promise( resolve => {
        const socket = tls.connect( {
            "host": remoteHostname,
            "port": remotePort,
            "servername": remoteHostname,
        } );

        socket.setKeepAlive( true, SOCKET_KEEP_ALIVE_TIMEOUT );

        socket.once( "error", e => resolve() );

        socket.once( "secureConnect", () => {
            socket.off( "error", resolve );

            socket.once( "error", e => {} );

            resolve( socket );
        } );
    } );
}
