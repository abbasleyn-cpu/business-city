const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const rooms = new Map();

const START_MONEY = 1500;
const START_BONUS = 200;
const MILESTONE = 10000;

const symbols = ["🔵", "🔴", "🟢", "🟡"];

/* =========================================================
   SPIELBRETT
========================================================= */

const fields = [
    { name: "START", type: "start" },

    {
        name: "Kleiner Laden",
        type: "company",
        price: 200,
        rent: 40,
        income: 60
    },

    {
        name: "Steuern",
        type: "tax",
        amount: 150
    },

    {
        name: "Café",
        type: "company",
        price: 300,
        rent: 60,
        income: 90
    },

    {
        name: "Ereignis",
        type: "event"
    },

    {
        name: "Restaurant",
        type: "company",
        price: 450,
        rent: 90,
        income: 120
    },

    {
        name: "Bonus",
        type: "bonus",
        amount: 250
    },

    {
        name: "Supermarkt",
        type: "company",
        price: 600,
        rent: 120,
        income: 160
    },

    {
        name: "Polizei",
        type: "police"
    },

    {
        name: "Hotel",
        type: "company",
        price: 800,
        rent: 160,
        income: 220
    },

    {
        name: "Börse",
        type: "stock"
    },

    {
        name: "Fabrik",
        type: "company",
        price: 1000,
        rent: 220,
        income: 290
    },

    {
        name: "Steuern",
        type: "tax",
        amount: 300
    },

    {
        name: "Bank",
        type: "bank"
    },

    {
        name: "Ereignis",
        type: "event"
    },

    {
        name: "Tech-Firma",
        type: "company",
        price: 1500,
        rent: 320,
        income: 430
    },

    {
        name: "Risiko",
        type: "risk"
    },

    {
        name: "Bauplatz",
        type: "build"
    },

    {
        name: "Superbonus",
        type: "bonus",
        amount: 500
    },

    {
        name: "Große Firma",
        type: "company",
        price: 2000,
        rent: 450,
        income: 600
    }
];


/* =========================================================
   HTTP SERVER
========================================================= */

const server = http.createServer((req, res) => {

    let filePath;

    if (req.url === "/") {
        filePath =
            path.join(
                __dirname,
                "public",
                "index.html"
            );
    } else {

        const cleanUrl =
            decodeURIComponent(
                req.url.split("?")[0]
            );

        filePath =
            path.join(
                __dirname,
                "public",
                cleanUrl
            );
    }


    fs.readFile(
        filePath,
        (error, data) => {

            if (error) {

                res.writeHead(
                    404,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );

                res.end(
                    "404 - Datei nicht gefunden"
                );

                return;
            }


            let contentType =
                "text/plain; charset=utf-8";


            if (
                filePath.endsWith(".html")
            ) {

                contentType =
                    "text/html; charset=utf-8";

            } else if (
                filePath.endsWith(".js")
            ) {

                contentType =
                    "application/javascript; charset=utf-8";

            } else if (
                filePath.endsWith(".css")
            ) {

                contentType =
                    "text/css; charset=utf-8";
            }


            res.writeHead(
                200,
                {
                    "Content-Type":
                        contentType
                }
            );


            res.end(data);
        }
    );
});


/* =========================================================
   WEBSOCKET
========================================================= */

const wss =
    new WebSocket.Server({
        server
    });


/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function send(
    ws,
    type,
    data = {}
) {

    if (
        ws &&
        ws.readyState ===
            WebSocket.OPEN
    ) {

        ws.send(
            JSON.stringify({
                type,
                ...data
            })
        );
    }
}


function broadcast(
    room,
    type,
    data = {}
) {

    for (
        const player
        of room.players.values()
    ) {

        send(
            player.ws,
            type,
            data
        );
    }
}


function randomRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    do {

        code = "";

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            code +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];
        }

    } while (
        rooms.has(code)
    );


    return code;
}


function randomId() {

    return crypto.randomUUID();
}


function activePlayers(room) {

    return [
        ...room.players.values()
    ].filter(
        player => player.active
    );
}


function currentPlayer(room) {

    const id =
        room.turnOrder[
            room.currentTurn
        ];

    return room.players.get(id);
}


function ownerOf(
    room,
    fieldIndex
) {

    for (
        const player
        of room.players.values()
    ) {

        if (
            player.active &&
            player.properties.includes(
                fieldIndex
            )
        ) {

            return player;
        }
    }

    return null;
}


function getIncome(player) {

    let total = 0;


    for (
        const fieldIndex
        of player.properties
    ) {

        const field =
            fields[fieldIndex];


        if (
            field &&
            field.income
        ) {

            total +=
                field.income;
        }
    }


    total +=
        player.stocks * 60;


    return total;
}


/* =========================================================
   SPIELSTAND FÜR EINEN BESTIMMTEN SPIELER
========================================================= */

function publicGame(
    room,
    viewerId
) {

    return {

        roomCode:
            room.code,

        hostId:
            room.hostId,

        yourId:
            viewerId,

        status:
            room.status,

        round:
            room.round,

        currentTurn:
            room.currentTurn,

        turnOrder:
            room.turnOrder,

        stockPrice:
            room.stockPrice,

        lastDice:
            room.lastDice,

        log:
            room.log.slice(-100),

        fields:
            JSON.parse(
                JSON.stringify(fields)
            ),

        players:
            [
                ...room.players.values()
            ].map(
                player => ({
                    id:
                        player.id,

                    name:
                        player.name,

                    symbol:
                        player.symbol,

                    money:
                        player.money,

                    position:
                        player.position,

                    properties:
                        [...player.properties],

                    stocks:
                        player.stocks,

                    loan:
                        player.loan,

                    active:
                        player.active,

                    skip:
                        player.skip,

                    milestone:
                        player.milestone,

                    connected:
                        Boolean(
                            player.ws
                        )
                })
            )
    };
}


/* =========================================================
   SPIELSTAND AN ALLE SENDEN
========================================================= */

function broadcastGame(room) {

    for (
        const player
        of room.players.values()
    ) {

        send(
            player.ws,
            "state",
            {
                game:
                    publicGame(
                        room,
                        player.id
                    )
            }
        );
    }
}


/* =========================================================
   LOG
========================================================= */

function addLog(
    room,
    text
) {

    room.log.push(text);

    if (
        room.log.length > 100
    ) {

        room.log =
            room.log.slice(-100);
    }
}


/* =========================================================
   RAUM ERSTELLEN
========================================================= */

function createRoom(
    name,
    ws
) {

    const code =
        randomRoomCode();

    const id =
        randomId();


    const player = {

        id,

        name,

        symbol:
            symbols[0],

        money:
            START_MONEY,

        position:
            0,

        properties:
            [],

        stocks:
            0,

        loan:
            0,

        active:
            true,

        skip:
            0,

        milestone:
            false,

        ws
    };


    const room = {

        code,

        hostId:
            id,

        status:
            "lobby",

        round:
            1,

        currentTurn:
            0,

        turnOrder:
            [id],

        stockPrice:
            100,

        lastDice:
            null,

        players:
            new Map([
                [id, player]
            ]),

        log:
            []
    };


    rooms.set(
        code,
        room
    );


    ws.playerId =
        id;

    ws.roomCode =
        code;


    addLog(
        room,
        `🏠 Raum ${code} wurde erstellt.`
    );


    return room;
}


/* =========================================================
   RAUM BEITRETEN
========================================================= */

function joinRoom(
    code,
    name,
    ws
) {

    const room =
        rooms.get(code);


    if (!room) {

        send(
            ws,
            "error",
            {
                message:
                    "Raum nicht gefunden."
            }
        );

        return;
    }


    if (
        room.status !==
        "lobby"
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Das Spiel läuft bereits."
            }
        );

        return;
    }


    if (
        room.players.size >= 4
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Der Raum ist voll."
            }
        );

        return;
    }


    const names =
        [
            ...room.players.values()
        ]
        .map(
            player =>
                player.name.toLowerCase()
        );


    if (
        names.includes(
            name.toLowerCase()
        )
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Dieser Name ist bereits vergeben."
            }
        );

        return;
    }


    const id =
        randomId();


    const index =
        room.players.size;


    const player = {

        id,

        name,

        symbol:
            symbols[index],

        money:
            START_MONEY,

        position:
            0,

        properties:
            [],

        stocks:
            0,

        loan:
            0,

        active:
            true,

        skip:
            0,

        milestone:
            false,

        ws
    };


    room.players.set(
        id,
        player
    );


    room.turnOrder.push(
        id
    );


    /*
     * WICHTIG:
     * Die ID gehört jetzt dauerhaft
     * zu diesem WebSocket.
     */

    ws.playerId =
        id;

    ws.roomCode =
        code;


    addLog(
        room,
        `${player.symbol} ${player.name} ist beigetreten.`
    );


    /*
     * ID sofort an diesen Spieler.
     */

    send(
        ws,
        "roomJoined",
        {
            roomCode:
                code,

            playerId:
                id
        }
    );


    broadcastGame(room);
}


/* =========================================================
   STARTEN
========================================================= */

function startGame(
    room,
    ws
) {

    if (
        room.hostId !==
        ws.playerId
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Nur der Host kann starten."
            }
        );

        return;
    }


    if (
        room.players.size < 2
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Mindestens 2 Spieler."
            }
        );

        return;
    }


    room.status =
        "playing";


    room.currentTurn =
        0;


    room.round =
        1;


    addLog(
        room,
        "🎮 Das Spiel beginnt!"
    );


    broadcastGame(room);
}


/* =========================================================
   WÜRFELN
========================================================= */

function rollDice(
    room,
    ws
) {

    if (
        room.status !==
        "playing"
    ) {
        return;
    }


    const player =
        room.players.get(
            ws.playerId
        );


    const current =
        currentPlayer(room);


    if (
        !player ||
        !current
    ) {
        return;
    }


    if (
        current.id !==
        player.id
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Du bist nicht dran."
            }
        );

        return;
    }


    if (
        !player.active
    ) {
        return;
    }


    /*
     * Strafpause
     */

    if (
        player.skip > 0
    ) {

        player.skip--;

        addLog(
            room,
            `⏸️ ${player.symbol} ${player.name} setzt aus.`
        );

        finishTurn(room);

        return;
    }


    const dice =
        Math.floor(
            Math.random() * 6
        ) + 1;


    room.lastDice =
        dice;


    const oldPosition =
        player.position;


    player.position =
        (
            player.position + dice
        )
        %
        fields.length;


    if (
        oldPosition + dice
        >=
        fields.length
    ) {

        player.money +=
            START_BONUS;


        addLog(
            room,
            `💰 ${player.symbol} ${player.name} erhält +${START_BONUS} Fr. für START.`
        );
    }


    addLog(
        room,
        `🎲 ${player.symbol} ${player.name} würfelt eine ${dice}.`
    );


    resolveField(
        room,
        player
    );
}


/* =========================================================
   FELD
========================================================= */

function resolveField(
    room,
    player
) {

    if (
        !player.active
    ) {
        return;
    }


    const field =
        fields[player.position];


    /*
     * UNTERNEHMEN
     */

    if (
        field.type ===
        "company"
    ) {

        const owner =
            ownerOf(
                room,
                player.position
            );


        if (!owner) {

            send(
                player.ws,
                "purchaseOffer",
                {
                    fieldIndex:
                        player.position,

                    field:
                        field
                }
            );


            broadcastGame(room);

            return;
        }


        if (
            owner.id !==
            player.id
        ) {

            player.money -=
                field.rent;


            owner.money +=
                field.rent;


            addLog(
                room,
                `💸 ${player.symbol} ${player.name} zahlt ${field.rent} Fr. Miete an ${owner.symbol} ${owner.name}.`
            );


            if (
                checkEliminations(room)
            ) {
                return;
            }
        }


        finishTurn(room);

        return;
    }


    /*
     * STEUER
     */

    if (
        field.type ===
        "tax"
    ) {

        player.money -=
            field.amount;


        addLog(
            room,
            `💸 ${player.symbol} ${player.name} zahlt ${field.amount} Fr. Steuern.`
        );


        if (
            checkEliminations(room)
        ) {
            return;
        }


        finishTurn(room);

        return;
    }


    /*
     * BONUS
     */

    if (
        field.type ===
        "bonus"
    ) {

        player.money +=
            field.amount;


        addLog(
            room,
            `🎁 ${player.symbol} ${player.name} erhält +${field.amount} Fr.`
        );


        checkMilestone(player);

        finishTurn(room);

        return;
    }


    /*
     * POLIZEI
     */

    if (
        field.type ===
        "police"
    ) {

        player.skip =
            1;


        addLog(
            room,
            `🚓 ${player.symbol} ${player.name} muss einmal aussetzen.`
        );


        finishTurn(room);

        return;
    }


    /*
     * BÖRSE
     */

    if (
        field.type ===
        "stock"
    ) {

        send(
            player.ws,
            "stockOffer",
            {
                price:
                    room.stockPrice
            }
        );


        broadcastGame(room);

        return;
    }


    /*
     * BANK
     */

    if (
        field.type ===
        "bank"
    ) {

        send(
            player.ws,
            "bankMenu"
        );


        broadcastGame(room);

        return;
    }


    /*
     * BAUPLATZ
     */

    if (
        field.type ===
        "build"
    ) {

        send(
            player.ws,
            "buildMenu"
        );


        broadcastGame(room);

        return;
    }


    /*
     * RISIKO
     */

    if (
        field.type ===
        "risk"
    ) {

        const win =
            Math.random() < 0.5;


        if (win) {

            player.money +=
                500;


            addLog(
                room,
                `🎲 ${player.symbol} ${player.name} gewinnt 500 Fr.!`
            );

        } else {

            player.money -=
                400;


            addLog(
                room,
                `🎲 ${player.symbol} ${player.name} verliert 400 Fr.`
            );
        }


        if (
            checkEliminations(room)
        ) {
            return;
        }


        finishTurn(room);

        return;
    }


    /*
     * EREIGNIS
     */

    if (
        field.type ===
        "event"
    ) {

        const events = [

            {
                text:
                    "📈 Wirtschaftsboom: +300 Fr.",

                amount:
                    300
            },

            {
                text:
                    "🚗 Reparatur: -200 Fr.",

                amount:
                    -200
            },

            {
                text:
                    "💼 Investor: +500 Fr.",

                amount:
                    500
            },

            {
                text:
                    "📦 Lieferung verloren: -250 Fr.",

                amount:
                    -250
            },

            {
                text:
                    "🎁 Überraschungsbonus: +400 Fr.",

                amount:
                    400
            },

            {
                text:
                    "📉 Schlechter Monat: -350 Fr.",

                amount:
                    -350
            }
        ];


        const event =
            events[
                Math.floor(
                    Math.random() *
                    events.length
                )
            ];


        player.money +=
            event.amount;


        addLog(
            room,
            `${player.symbol} ${player.name}: ${event.text}`
        );


        checkMilestone(player);


        if (
            checkEliminations(room)
        ) {
            return;
        }


        finishTurn(room);

        return;
    }


    finishTurn(room);
}


/* =========================================================
   UNTERNEHMEN KAUFEN
========================================================= */

function buyCompany(
    room,
    ws,
    fieldIndex
) {

    const player =
        room.players.get(
            ws.playerId
        );


    const current =
        currentPlayer(room);


    if (
        !player ||
        !current ||
        current.id !== player.id
    ) {
        return;
    }


    /*
     * Nicht kaufen
     */

    if (
        Number(fieldIndex) < 0
    ) {

        finishTurn(room);

        return;
    }


    if (
        player.position !==
        Number(fieldIndex)
    ) {
        return;
    }


    const field =
        fields[
            Number(fieldIndex)
        ];


    if (
        !field ||
        field.type !==
            "company"
    ) {
        return;
    }


    if (
        ownerOf(
            room,
            Number(fieldIndex)
        )
    ) {
        return;
    }


    if (
        player.money <
        field.price
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Nicht genug Geld."
            }
        );


        finishTurn(room);

        return;
    }


    player.money -=
        field.price;


    player.properties.push(
        Number(fieldIndex)
    );


    addLog(
        room,
        `🏢 ${player.symbol} ${player.name} kauft ${field.name} für ${field.price} Fr.`
    );


    checkMilestone(player);


    finishTurn(room);
}


/* =========================================================
   AKTIEN
========================================================= */

function stockAction(
    room,
    ws,
    shouldBuy
) {

    const player =
        room.players.get(
            ws.playerId
        );


    const current =
        currentPlayer(room);


    if (
        !player ||
        !current ||
        current.id !== player.id
    ) {
        return;
    }


    if (!shouldBuy) {

        finishTurn(room);

        return;
    }


    if (
        player.money <
        room.stockPrice
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Nicht genug Geld."
            }
        );


        finishTurn(room);

        return;
    }


    const price =
        room.stockPrice;


    player.money -=
        price;


    player.stocks++;


    addLog(
        room,
        `📈 ${player.symbol} ${player.name} kauft eine Aktie für ${price} Fr.`
    );


    finishTurn(room);
}


/* =========================================================
   BANK
========================================================= */

function bankAction(
    room,
    ws,
    action
) {

    const player =
        room.players.get(
            ws.playerId
        );


    const current =
        currentPlayer(room);


    if (
        !player ||
        !current ||
        current.id !== player.id
    ) {
        return;
    }


    if (
        action === "loan"
    ) {

        player.money +=
            500;

        player.loan +=
            500;


        addLog(
            room,
            `🏦 ${player.symbol} ${player.name} nimmt 500 Fr. Kredit auf.`
        );
    }


    if (
        action === "repay"
    ) {

        if (
            player.loan > 0
            &&
            player.money > 0
        ) {

            const amount =
                Math.min(
                    500,
                    player.loan,
                    player.money
                );


            player.money -=
                amount;


            player.loan -=
                amount;


            addLog(
                room,
                `🏦 ${player.symbol} ${player.name} zahlt ${amount} Fr. Kredit zurück.`
            );

        } else {

            send(
                ws,
                "error",
                {
                    message:
                        "Kein Kredit oder kein Geld vorhanden."
                }
            );
        }
    }


    if (
        checkEliminations(room)
    ) {
        return;
    }


    finishTurn(room);
}


/* =========================================================
   BAUEN
========================================================= */

function buildAction(
    room,
    ws
) {

    const player =
        room.players.get(
            ws.playerId
        );


    const current =
        currentPlayer(room);


    if (
        !player ||
        !current ||
        current.id !== player.id
    ) {
        return;
    }


    if (
        player.properties.length === 0
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Du besitzt noch kein Unternehmen."
            }
        );


        finishTurn(room);

        return;
    }


    const selected =
        player.properties[
            Math.floor(
                Math.random() *
                player.properties.length
            )
        ];


    const field =
        fields[selected];


    const cost =
        Math.round(
            field.price * 0.5
        );


    if (
        player.money < cost
    ) {

        send(
            ws,
            "error",
            {
                message:
                    "Nicht genug Geld."
            }
        );


        finishTurn(room);

        return;
    }


    player.money -=
        cost;


    field.income +=
        100;


    addLog(
        room,
        `🏗️ ${player.symbol} ${player.name} baut ${field.name} aus.`
    );


    finishTurn(room);
}


/* =========================================================
   RUNDENEINNAHMEN
========================================================= */

function collectRoundIncome(room) {

    const stockChange =
        Math.floor(
            Math.random() * 81
        ) - 40;


    room.stockPrice =
        Math.max(
            20,
            room.stockPrice +
                stockChange
        );


    for (
        const player
        of room.players.values()
    ) {

        if (
            !player.active
        ) {
            continue;
        }


        const income =
            getIncome(player);


        if (
            income > 0
        ) {

            player.money +=
                income;


            addLog(
                room,
                `💰 ${player.symbol} ${player.name} erhält +${income} Fr.`
            );


            checkMilestone(player);
        }
    }


    checkEliminations(room);
}


/* =========================================================
   ELIMINATION
========================================================= */

function checkEliminations(room) {

    for (
        const player
        of room.players.values()
    ) {

        if (
            player.active
            &&
            player.money <= 0
        ) {

            player.active =
                false;


            player.properties =
                [];

            player.stocks =
                0;


            addLog(
                room,
                `💀 ${player.symbol} ${player.name} scheidet aus!`
            );
        }
    }


    const alive =
        activePlayers(room);


    if (
        alive.length === 1
    ) {

        room.status =
            "finished";


        addLog(
            room,
            `🏆 ${alive[0].symbol} ${alive[0].name} gewinnt das Spiel!`
        );


        broadcastGame(room);

        return true;
    }


    if (
        alive.length === 0
    ) {

        room.status =
            "finished";


        addLog(
            room,
            "💀 Alle Spieler sind ausgeschieden."
        );


        broadcastGame(room);

        return true;
    }


    return false;
}


/* =========================================================
   MEILENSTEIN
========================================================= */

function checkMilestone(
    player
) {

    if (
        player.money >=
        MILESTONE
        &&
        !player.milestone
    ) {

        player.milestone =
            true;
    }
}


/* =========================================================
   ZUG WEITER
========================================================= */

function finishTurn(room) {

    if (
        room.status !==
        "playing"
    ) {

        broadcastGame(room);

        return;
    }


    const oldTurn =
        room.currentTurn;


    let nextTurn =
        oldTurn;


    for (
        let i = 1;
        i <= room.turnOrder.length;
        i++
    ) {

        const candidate =
            (
                oldTurn + i
            )
            %
            room.turnOrder.length;


        const id =
            room.turnOrder[
                candidate
            ];


        const player =
            room.players.get(id);


        if (
            player &&
            player.active
        ) {

            nextTurn =
                candidate;

            break;
        }
    }


    room.currentTurn =
        nextTurn;


    /*
     * Neue Runde
     */

    if (
        nextTurn === 0
        &&
        oldTurn !== 0
    ) {

        room.round++;


        collectRoundIncome(
            room
        );


        if (
            room.status !==
            "playing"
        ) {

            broadcastGame(room);

            return;
        }


        addLog(
            room,
            `🔄 Runde ${room.round} beginnt.`
        );
    }


    broadcastGame(room);
}


/* =========================================================
   VERBINDUNG GETRENNT
========================================================= */

function disconnectPlayer(ws) {

    const room =
        rooms.get(
            ws.roomCode
        );


    if (!room) {
        return;
    }


    const player =
        room.players.get(
            ws.playerId
        );


    if (!player) {
        return;
    }


    player.ws =
        null;


    addLog(
        room,
        `🔌 ${player.symbol} ${player.name} ist offline.`
    );


    broadcastGame(room);
}


/* =========================================================
   WEBSOCKET
========================================================= */

wss.on(
    "connection",
    ws => {

        send(
            ws,
            "connected"
        );


        ws.on(
            "message",
            raw => {

                let message;


                try {

                    message =
                        JSON.parse(
                            raw.toString()
                        );

                } catch {

                    send(
                        ws,
                        "error",
                        {
                            message:
                                "Ungültige Nachricht."
                        }
                    );

                    return;
                }


                /* Raum erstellen */

                if (
                    message.type ===
                    "createRoom"
                ) {

                    const name =
                        String(
                            message.name || ""
                        )
                            .trim()
                            .slice(0, 20);


                    if (!name) {

                        send(
                            ws,
                            "error",
                            {
                                message:
                                    "Bitte Namen eingeben."
                            }
                        );

                        return;
                    }


                    const room =
                        createRoom(
                            name,
                            ws
                        );


                    send(
                        ws,
                        "roomCreated",
                        {
                            roomCode:
                                room.code,

                            playerId:
                                ws.playerId
                        }
                    );


                    broadcastGame(room);

                    return;
                }


                /* Raum beitreten */

                if (
                    message.type ===
                    "joinRoom"
                ) {

                    const name =
                        String(
                            message.name || ""
                        )
                            .trim()
                            .slice(0, 20);


                    const code =
                        String(
                            message.code || ""
                        )
                            .trim()
                            .toUpperCase();


                    if (
                        !name
                        ||
                        code.length !== 6
                    ) {

                        send(
                            ws,
                            "error",
                            {
                                message:
                                    "Name oder Raumcode ungültig."
                            }
                        );

                        return;
                    }


                    joinRoom(
                        code,
                        name,
                        ws
                    );


                    return;
                }


                const room =
                    rooms.get(
                        ws.roomCode
                    );


                if (!room) {

                    send(
                        ws,
                        "error",
                        {
                            message:
                                "Du bist in keinem Raum."
                        }
                    );

                    return;
                }


                /* Start */

                if (
                    message.type ===
                    "startGame"
                ) {

                    startGame(
                        room,
                        ws
                    );

                    return;
                }


                /* Würfeln */

                if (
                    message.type ===
                    "roll"
                ) {

                    rollDice(
                        room,
                        ws
                    );

                    return;
                }


                /* Unternehmen kaufen */

                if (
                    message.type ===
                    "buyCompany"
                ) {

                    buyCompany(
                        room,
                        ws,
                        Number(
                            message.fieldIndex
                        )
                    );

                    return;
                }


                /* Aktie */

                if (
                    message.type ===
                    "buyStock"
                ) {

                    stockAction(
                        room,
                        ws,
                        Boolean(
                            message.buy
                        )
                    );

                    return;
                }


                /* Bank */

                if (
                    message.type ===
                    "bank"
                ) {

                    bankAction(
                        room,
                        ws,
                        message.action
                    );

                    return;
                }


                /* Bauen */

                if (
                    message.type ===
                    "build"
                ) {

                    buildAction(
                        room,
                        ws
                    );

                    return;
                }

            }
        );


        ws.on(
            "close",
            () => {
                disconnectPlayer(ws);
            }
        );


        ws.on(
            "error",
            () => {
                disconnectPlayer(ws);
            }
        );
    }
);


/* =========================================================
   SERVER START
========================================================= */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Business City läuft auf Port ${PORT}`
        );

    }
);
