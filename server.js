const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const rooms = new Map();

/* =========================================================
   SPIELBRETT
========================================================= */

const fields = [
    {
        name: "START",
        type: "start"
    },

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

const symbols = ["🔵", "🔴", "🟢", "🟡"];

const START_MONEY = 1500;
const START_BONUS = 200;
const WIN_MILESTONE = 10000;


/* =========================================================
   HTTP SERVER
========================================================= */

const server = http.createServer((req, res) => {
    let filePath;

    if (req.url === "/") {
        filePath = path.join(__dirname, "public", "index.html");
    } else {
        filePath = path.join(
            __dirname,
            "public",
            decodeURIComponent(req.url.split("?")[0])
        );
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });
            res.end("404 - Datei nicht gefunden");
            return;
        }

        let contentType = "text/plain; charset=utf-8";

        if (filePath.endsWith(".html")) {
            contentType = "text/html; charset=utf-8";
        } else if (filePath.endsWith(".js")) {
            contentType = "text/javascript; charset=utf-8";
        } else if (filePath.endsWith(".css")) {
            contentType = "text/css; charset=utf-8";
        }

        res.writeHead(200, {
            "Content-Type": contentType
        });

        res.end(content);
    });
});


/* =========================================================
   WEBSOCKET
========================================================= */

const wss = new WebSocket.Server({
    server
});


/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function send(ws, type, data = {}) {
    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {
        ws.send(
            JSON.stringify({
                type,
                ...data
            })
        );
    }
}


function broadcast(room, type, data = {}) {
    for (const player of room.players.values()) {
        send(player.ws, type, data);
    }
}


function broadcastGame(room) {
    const game = createPublicGame(room);

    broadcast(
        room,
        "state",
        {
            game
        }
    );
}


function randomRoomCode() {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];
        }
    } while (rooms.has(code));

    return code;
}


function randomId() {
    return crypto.randomUUID();
}


function money(value) {
    return Math.round(value);
}


function activePlayers(room) {
    return [...room.players.values()]
        .filter(player => player.active);
}


function playerById(room, id) {
    return room.players.get(id);
}


function currentPlayer(room) {
    const id =
        room.turnOrder[room.currentTurn];

    return room.players.get(id);
}


function ownerOf(room, fieldIndex) {
    for (const player of room.players.values()) {
        if (
            player.active &&
            player.properties.includes(fieldIndex)
        ) {
            return player;
        }
    }

    return null;
}


function getIncome(player) {
    let total = 0;

    for (const fieldIndex of player.properties) {
        const field = fields[fieldIndex];

        if (field && field.income) {
            total += field.income;
        }
    }

    total += player.stocks * 60;

    return total;
}


/* =========================================================
   ÖFFENTLICHEN SPIELSTAND ERSTELLEN
========================================================= */

function createPublicGame(room) {
    return {
        roomCode: room.code,
        hostId: room.hostId,
        status: room.status,
        round: room.round,
        currentTurn: room.currentTurn,
        turnOrder: room.turnOrder,

        stockPrice: room.stockPrice,

        lastDice: room.lastDice,

        log: room.log.slice(-80),

        fields,

        players: [...room.players.values()].map(player => ({
            id: player.id,
            name: player.name,
            symbol: player.symbol,
            money: player.money,
            position: player.position,
            properties: player.properties,
            stocks: player.stocks,
            loan: player.loan,
            active: player.active,
            skip: player.skip,
            milestone: player.milestone,
            connected: Boolean(player.ws)
        }))
    };
}


/* =========================================================
   LOG
========================================================= */

function addLog(room, text) {
    room.log.push(text);

    if (room.log.length > 100) {
        room.log = room.log.slice(-100);
    }
}


/* =========================================================
   NEUEN RAUM
========================================================= */

function createRoom(name, ws) {
    const code = randomRoomCode();
    const id = randomId();

    const player = {
        id,
        name,
        symbol: symbols[0],
        money: START_MONEY,
        position: 0,
        properties: [],
        stocks: 0,
        loan: 0,
        active: true,
        skip: 0,
        milestone: false,
        ws
    };

    const room = {
        code,
        hostId: id,
        status: "lobby",

        round: 1,
        currentTurn: 0,
        turnOrder: [id],

        stockPrice: 100,
        lastDice: null,

        players: new Map([
            [id, player]
        ]),

        log: []
    };

    rooms.set(code, room);

    addLog(
        room,
        `🏠 Raum ${code} wurde erstellt.`
    );

    ws.playerId = id;
    ws.roomCode = code;

    return room;
}


/* =========================================================
   RAUM BEITRETEN
========================================================= */

function joinRoom(code, name, ws) {
    const room = rooms.get(code);

    if (!room) {
        send(ws, "error", {
            message: "Raum nicht gefunden."
        });
        return;
    }

    if (room.status !== "lobby") {
        send(ws, "error", {
            message: "Das Spiel läuft bereits."
        });
        return;
    }

    if (room.players.size >= 4) {
        send(ws, "error", {
            message: "Der Raum ist voll."
        });
        return;
    }

    const existingNames =
        [...room.players.values()]
            .map(player => player.name.toLowerCase());

    if (
        existingNames.includes(
            name.toLowerCase()
        )
    ) {
        send(ws, "error", {
            message: "Dieser Name ist bereits vergeben."
        });
        return;
    }

    const id = randomId();

    const player = {
        id,
        name,
        symbol: symbols[room.players.size],
        money: START_MONEY,
        position: 0,
        properties: [],
        stocks: 0,
        loan: 0,
        active: true,
        skip: 0,
        milestone: false,
        ws
    };

    room.players.set(id, player);
    room.turnOrder.push(id);

    ws.playerId = id;
    ws.roomCode = code;

    addLog(
        room,
        `${player.symbol} ${player.name} ist beigetreten.`
    );

    broadcastGame(room);
}


/* =========================================================
   SPIEL STARTEN
========================================================= */

function startGame(room, ws) {
    if (room.hostId !== ws.playerId) {
        send(ws, "error", {
            message: "Nur der Host kann starten."
        });
        return;
    }

    if (room.players.size < 2) {
        send(ws, "error", {
            message: "Mindestens 2 Spieler sind nötig."
        });
        return;
    }

    room.status = "playing";
    room.round = 1;
    room.currentTurn = 0;

    addLog(
        room,
        "🎮 Das Spiel beginnt!"
    );

    broadcastGame(room);
}


/* =========================================================
   WÜRFELN
========================================================= */

function rollDice(room, ws) {
    if (room.status !== "playing") {
        return;
    }

    const player =
        playerById(room, ws.playerId);

    const current =
        currentPlayer(room);

    if (!player || !current) {
        return;
    }

    if (
        player.id !== current.id
        ||
        !player.active
    ) {
        send(ws, "error", {
            message: "Du bist nicht am Zug."
        });
        return;
    }

    if (player.skip > 0) {
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

    room.lastDice = dice;

    const oldPosition =
        player.position;

    player.position =
        (
            player.position + dice
        ) % fields.length;

    if (
        oldPosition + dice >=
        fields.length
    ) {
        player.money += START_BONUS;

        addLog(
            room,
            `💰 ${player.symbol} ${player.name} erhält +${START_BONUS} Fr. für START.`
        );
    }

    addLog(
        room,
        `🎲 ${player.symbol} ${player.name} würfelt eine ${dice}.`
    );

    resolveField(room, player);
}


/* =========================================================
   FELD AUFLÖSEN
========================================================= */

function resolveField(room, player) {
    const field =
        fields[player.position];

    if (!player.active) {
        return;
    }

    if (field.type === "company") {
        const owner =
            ownerOf(room, player.position);

        if (!owner) {
            send(player.ws, "purchaseOffer", {
                fieldIndex: player.position,
                field
            });

            return;
        }

        if (owner.id !== player.id) {
            player.money -= field.rent;
            owner.money += field.rent;

            addLog(
                room,
                `💸 ${player.symbol} ${player.name} zahlt ${field.rent} Fr. Miete an ${owner.symbol} ${owner.name}.`
            );
        }

        checkEliminations(room);

        if (room.status === "playing") {
            finishTurn(room);
        }

        return;
    }

    if (field.type === "tax") {
        player.money -= field.amount;

        addLog(
            room,
            `💸 ${player.symbol} ${player.name} zahlt ${field.amount} Fr. Steuern.`
        );

        checkEliminations(room);

        if (room.status === "playing") {
            finishTurn(room);
        }

        return;
    }

    if (field.type === "bonus") {
        player.money += field.amount;

        addLog(
            room,
            `🎁 ${player.symbol} ${player.name} erhält ${field.amount} Fr. Bonus.`
        );

        checkMilestone(player);
        finishTurn(room);
        return;
    }

    if (field.type === "police") {
        player.skip = 1;

        addLog(
            room,
            `🚓 ${player.symbol} ${player.name} muss einmal aussetzen.`
        );

        finishTurn(room);
        return;
    }

    if (field.type === "stock") {
        send(player.ws, "stockOffer", {
            price: room.stockPrice
        });

        return;
    }

    if (field.type === "bank") {
        send(player.ws, "bankMenu");
        return;
    }

    if (field.type === "build") {
        send(player.ws, "buildMenu");
        return;
    }

    if (field.type === "risk") {
        const win =
            Math.random() < 0.5;

        if (win) {
            player.money += 500;

            addLog(
                room,
                `🎲 ${player.symbol} ${player.name} gewinnt 500 Fr. beim Risiko!`
            );
        } else {
            player.money -= 400;

            addLog(
                room,
                `🎲 ${player.symbol} ${player.name} verliert 400 Fr. beim Risiko.`
            );
        }

        checkEliminations(room);

        if (room.status === "playing") {
            finishTurn(room);
        }

        return;
    }

    if (field.type === "event") {
        const events = [
            {
                text: "📈 Wirtschaftsboom: +300 Fr.",
                amount: 300
            },
            {
                text: "🚗 Reparatur: -200 Fr.",
                amount: -200
            },
            {
                text: "💼 Investor: +500 Fr.",
                amount: 500
            },
            {
                text: "📦 Lieferung verloren: -250 Fr.",
                amount: -250
            },
            {
                text: "🎁 Überraschungsbonus: +400 Fr.",
                amount: 400
            },
            {
                text: "📉 Schlechter Monat: -350 Fr.",
                amount: -350
            }
        ];

        const event =
            events[
                Math.floor(
                    Math.random() * events.length
                )
            ];

        player.money += event.amount;

        addLog(
            room,
            `${player.symbol} ${player.name}: ${event.text}`
        );

        checkMilestone(player);
        checkEliminations(room);

        if (room.status === "playing") {
            finishTurn(room);
        }

        return;
    }

    finishTurn(room);
}


/* =========================================================
   UNTERNEHMEN KAUFEN
========================================================= */

function buyCompany(room, ws, fieldIndex) {
    const player =
        playerById(room, ws.playerId);

    const current =
        currentPlayer(room);

    if (!player || !current) {
        return;
    }

    if (
        player.id !== current.id
        ||
        !player.active
    ) {
        return;
    }

    if (
        player.position !== fieldIndex
    ) {
        return;
    }

    const field =
        fields[fieldIndex];

    if (!field || field.type !== "company") {
        return;
    }

    const owner =
        ownerOf(room, fieldIndex);

    if (owner) {
        return;
    }

    if (
        player.money < field.price
    ) {
        send(ws, "error", {
            message: "Nicht genug Geld."
        });

        finishTurn(room);
        return;
    }

    player.money -= field.price;

    player.properties.push(
        fieldIndex
    );

    addLog(
        room,
        `🏢 ${player.symbol} ${player.name} kauft ${field.name} für ${field.price} Fr.`
    );

    checkMilestone(player);
    finishTurn(room);
}


/* =========================================================
   AKTIE KAUFEN
========================================================= */

function buyStockAction(room, ws, buy) {
    const player =
        playerById(room, ws.playerId);

    const current =
        currentPlayer(room);

    if (
        !player ||
        !current ||
        player.id !== current.id
    ) {
        return;
    }

    if (!buy) {
        finishTurn(room);
        return;
    }

    if (
        player.money <
        room.stockPrice
    ) {
        send(ws, "error", {
            message: "Nicht genug Geld für die Aktie."
        });

        finishTurn(room);
        return;
    }

    player.money -= room.stockPrice;
    player.stocks++;

    addLog(
        room,
        `📈 ${player.symbol} ${player.name} kauft eine Aktie für ${room.stockPrice} Fr.`
    );

    finishTurn(room);
}


/* =========================================================
   BANK / KREDIT
========================================================= */

function bankAction(room, ws, action) {
    const player =
        playerById(room, ws.playerId);

    const current =
        currentPlayer(room);

    if (
        !player ||
        !current ||
        player.id !== current.id
    ) {
        return;
    }

    if (action === "loan") {
        player.money += 500;
        player.loan += 500;

        addLog(
            room,
            `🏦 ${player.symbol} ${player.name} nimmt 500 Fr. Kredit auf.`
        );
    }

    else if (action === "repay") {
        if (player.loan <= 0) {
            send(ws, "error", {
                message: "Du hast keinen Kredit."
            });
        } else {
            const amount =
                Math.min(
                    500,
                    player.loan,
                    player.money
                );

            player.money -= amount;
            player.loan -= amount;

            addLog(
                room,
                `🏦 ${player.symbol} ${player.name} zahlt ${amount} Fr. Kredit zurück.`
            );
        }
    }

    checkEliminations(room);

    if (room.status === "playing") {
        finishTurn(room);
    }
}


/* =========================================================
   AUSBAU
========================================================= */

function buildAction(room, ws) {
    const player =
        playerById(room, ws.playerId);

    const current =
        currentPlayer(room);

    if (
        !player ||
        !current ||
        player.id !== current.id
    ) {
        return;
    }

    if (
        player.properties.length === 0
    ) {
        send(ws, "error", {
            message: "Du besitzt noch kein Unternehmen."
        });

        finishTurn(room);
        return;
    }

    const chosen =
        player.properties[
            Math.floor(
                Math.random() *
                player.properties.length
            )
        ];

    const field =
        fields[chosen];

    const cost =
        Math.round(field.price * 0.5);

    if (
        player.money < cost
    ) {
        send(ws, "error", {
            message: "Nicht genug Geld für den Ausbau."
        });

        finishTurn(room);
        return;
    }

    player.money -= cost;

    field.income += 100;

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
            room.stockPrice + stockChange
        );

    for (const player of room.players.values()) {
        if (!player.active) {
            continue;
        }

        const income =
            getIncome(player);

        if (income > 0) {
            player.money += income;

            addLog(
                room,
                `💰 ${player.symbol} ${player.name} erhält +${income} Fr.`
            );
        }

        checkMilestone(player);
    }

    checkEliminations(room);
}


/* =========================================================
   SPIELER ELIMINIEREN
========================================================= */

function checkEliminations(room) {
    for (const player of room.players.values()) {
        if (
            player.active &&
            player.money <= 0
        ) {
            player.active = false;
            player.properties = [];
            player.stocks = 0;

            addLog(
                room,
                `💀 ${player.symbol} ${player.name} ist pleite und scheidet aus!`
            );
        }
    }

    const alive =
        activePlayers(room);

    if (alive.length === 1) {
        room.status = "finished";

        addLog(
            room,
            `🏆 ${alive[0].symbol} ${alive[0].name} gewinnt das Spiel!`
        );

        broadcastGame(room);
        return true;
    }

    if (alive.length === 0) {
        room.status = "finished";

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
   10.000-FR-MEILENSTEIN
========================================================= */

function checkMilestone(player) {
    if (
        player.money >= WIN_MILESTONE
        &&
        !player.milestone
    ) {
        player.milestone = true;
    }
}


/* =========================================================
   NÄCHSTER ZUG
========================================================= */

function finishTurn(room) {
    if (room.status !== "playing") {
        broadcastGame(room);
        return;
    }

    const before =
        room.currentTurn;

    let found = false;

    for (
        let i = 1;
        i <= room.turnOrder.length;
        i++
    ) {
        const index =
            (
                before + i
            ) %
            room.turnOrder.length;

        const id =
            room.turnOrder[index];

        const player =
            room.players.get(id);

        if (
            player &&
            player.active
        ) {
            room.currentTurn = index;
            found = true;
            break;
        }
    }

    if (!found) {
        room.status = "finished";
        broadcastGame(room);
        return;
    }

    if (
        room.currentTurn === 0
        &&
        before !== 0
    ) {
        room.round++;

        collectRoundIncome(room);

        if (room.status !== "playing") {
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
   TRENNUNG
========================================================= */

function handleDisconnect(ws) {
    const roomCode =
        ws.roomCode;

    const playerId =
        ws.playerId;

    if (!roomCode || !playerId) {
        return;
    }

    const room =
        rooms.get(roomCode);

    if (!room) {
        return;
    }

    const player =
        room.players.get(playerId);

    if (player) {
        player.ws = null;

        addLog(
            room,
            `🔌 ${player.symbol} ${player.name} ist nicht mehr verbunden.`
        );
    }

    broadcastGame(room);
}


/* =========================================================
   WEBSOCKET EVENTS
========================================================= */

wss.on("connection", ws => {

    send(ws, "connected");


    ws.on("message", raw => {

        let message;

        try {
            message =
                JSON.parse(
                    raw.toString()
                );
        } catch {
            send(ws, "error", {
                message: "Ungültige Nachricht."
            });
            return;
        }


        if (
            message.type === "createRoom"
        ) {

            const name =
                String(message.name || "")
                    .trim()
                    .slice(0, 20);

            if (!name) {
                send(ws, "error", {
                    message: "Bitte einen Namen eingeben."
                });
                return;
            }

            const room =
                createRoom(
                    name,
                    ws
                );

            send(ws, "roomCreated", {
                roomCode: room.code,
                playerId: ws.playerId
            });

            broadcastGame(room);

            return;
        }


        if (
            message.type === "joinRoom"
        ) {

            const name =
                String(message.name || "")
                    .trim()
                    .slice(0, 20);

            const code =
                String(message.code || "")
                    .trim()
                    .toUpperCase();

            if (!name || code.length !== 6) {
                send(ws, "error", {
                    message: "Name oder Raumcode ungültig."
                });
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
            rooms.get(ws.roomCode);

        if (!room) {
            send(ws, "error", {
                message: "Du bist in keinem Raum."
            });
            return;
        }


        if (
            message.type === "startGame"
        ) {

            startGame(room, ws);
            return;
        }


        if (
            message.type === "roll"
        ) {

            rollDice(room, ws);
            return;
        }


        if (
            message.type === "buyCompany"
        ) {

            buyCompany(
                room,
                ws,
                Number(message.fieldIndex)
            );

            return;
        }


        if (
            message.type === "buyStock"
        ) {

            buyStockAction(
                room,
                ws,
                Boolean(message.buy)
            );

            return;
        }


        if (
            message.type === "bank"
        ) {

            bankAction(
                room,
                ws,
                message.action
            );

            return;
        }


        if (
            message.type === "build"
        ) {

            buildAction(
                room,
                ws
            );

            return;
        }


        if (
            message.type === "reset"
        ) {

            if (
                room.hostId !== ws.playerId
            ) {
                return;
            }

            rooms.delete(
                room.code
            );

            send(ws, "reset");

            return;
        }

    });


    ws.on("close", () => {
        handleDisconnect(ws);
    });


    ws.on("error", () => {
        handleDisconnect(ws);
    });

});


/* =========================================================
   SERVER START
========================================================= */

server.listen(
    PORT,
    () => {
        console.log(
            `Business City läuft auf Port ${PORT}`
        );
    }
);