#!/usr/bin/env node
// vim: ft=javascript

import net from "node:net";
import tls from "node:tls";
import childProcess from "node:child_process";
import fs from "node:fs";

var args = [],
    localHostname = "127.0.0.1",
    localPort,
    remoteHostname = process.env.PGHOST,
    remotePort = process.env.PGPORT || "5432",
    remoteUsername = process.env.PGUSER || process.env.USER,
    remoteDatabase;

parseArgv();

remoteDatabase ||= remoteUsername;

const remoteSocket = await new Promise( resolve => {
    const socket = tls.connect( {
        "host": remoteHostname,
        "port": remotePort,
        "servername": remoteHostname,
    } );

    socket.once( "error", e => {
        console.log( e + "" );

        process.exit( 1 );
    } );

    socket.once( "secureConnect", () => resolve( socket ) );
} );

const server = await new Promise( resolve => {
    const server = new net.Server();

    server.once( "listening", () => {
        localPort = server.address().port;

        resolve( server );
    } );

    server.listen( null, "127.0.0.1" );
} );

server.once( "connection", localSocket => {
    localSocket.pipe( remoteSocket );
    remoteSocket.pipe( localSocket );
} );

args.push( "--host", localHostname );
args.push( "--port", localPort );
args.push( "--username", remoteUsername );
if ( remoteDatabase !== remoteUsername ) args.push( "--dbname", remoteDatabase );

parsePgpass();

const psql = childProcess.spawn( "psql", args, {
    "stdio": "inherit",
} );

psql.on( "exit", code => process.exit( code ) );

function parseArgv () {
    const argv = [...process.argv.slice( 2 )];

    for ( let n = 0; n < argv.length; n++ ) {
        const arg = argv[n];

        if ( arg === "-h" || arg === "--host" ) {
            remoteHostname = argv[n + 1];

            n++;
        }
        else if ( arg === "-p" || arg === "--port" ) {
            remotePort = argv[n + 1];

            n++;
        }
        else if ( arg === "-U" || arg === "--username" ) {
            remoteUsername = argv[n + 1];

            n++;
        }
        else if ( arg === "-d" || arg === "--dbname" ) {
            remoteDatabase = argv[n + 1];

            n++;
        }

        // equation
        else if ( arg.startsWith( "-h=" ) ) {
            remoteHostname = arg.substring( 3 );
        }
        else if ( arg.startsWith( "--host=" ) ) {
            remoteHostname = arg.substring( 7 );
        }
        else if ( arg.startsWith( "-p=" ) ) {
            remotePort = arg.substring( 3 );
        }
        else if ( arg.startsWith( "--port=" ) ) {
            remotePort = arg.substring( 7 );
        }
        else if ( arg.startsWith( "-U=" ) ) {
            remoteUsername = arg.substring( 3 );
        }
        else if ( arg.startsWith( "--username=" ) ) {
            remoteUsername = arg.substring( 11 );
        }
        else if ( arg.startsWith( "-d=" ) ) {
            remoteDatabase = arg.substring( 3 );
        }
        else if ( arg.startsWith( "--database=" ) ) {
            remoteDatabase = arg.substring( 11 );
        }
        else {
            args.push( arg );
        }
    }
}

function parsePgpass () {
    if ( process.env.PGPASSWORD ) return;

    if ( !fs.existsSync( process.env.HOME + "/.pgpass" ) ) return;

    const pgpass = fs.readFileSync( process.env.HOME + "/.pgpass", "latin1" ).split( "\n" );

    for ( let line of pgpass ) {
        line = line.trim();

        if ( !line || line.startsWith( "#" ) ) continue;

        const [hostname, port, database, username, password] = line.split( ":" );

        if ( hostname !== "*" && hostname !== remoteHostname ) continue;
        if ( port !== "*" && port !== remotePort ) continue;
        if ( database !== "*" && database !== remoteDatabase ) continue;
        if ( username !== "*" && username !== remoteUsername ) continue;

        process.env.PGPASSWORD = password;

        return;
    }
}
