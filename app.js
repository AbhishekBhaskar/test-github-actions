const express = require("express");
const bodyParser = require("body-parser");
const { graphqlHTTP } = require("express-graphql");
const { buildSchema } = require("graphql");
const mongoose = require("mongoose");
const Event = require("./models/event");
const User = require("./models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const isAuth = require("./middleware/is-auth");

const app = express();
app.use(bodyParser.json());

mongoose.connect(`mongodb+srv://abhishekbhaskar27:Monitor_8%2F27@abhishek-test-cluster.wndyi.mongodb.net/events-react-dev?retryWrites=true&w=majority&appName=Abhishek-Test-Cluster`)
.then(() => console.log("Mongodb connected successfully"))
.catch((err) => console.error("Error in connecting to mongodb", err));

const events = [];

app.use(isAuth);

app.use("/graphql", graphqlHTTP({
    schema: buildSchema(`
        type Event {
            _id: ID!,
            title: String!
            description: String!
            price: Float!
            date: String!
        }

        type User {
            _id: ID!,
            email: String!,
            password: String
        }

        type AuthData {
            userId: ID!
            token: String!
            tokenExpiration: Int!
        }

        input EventInput {
            title: String!
            description: String!
            price: Float!
            date: String!
        }

        input UserInput {
            email: String!,
            password: String!
        }

        type RootQuery {
            events: [Event!]!
            login(email: String!, password: String!): AuthData!
        }

        type RootMutation {
            createEvent(eventInput: EventInput): Event
            createUser(userInput: UserInput): User
        }    
    
        schema {
            query: RootQuery,
            mutation: RootMutation
        }
    `),
    rootValue: {
        events: () => {
            return Event.find()
            .then(events => {
                return events.map(e => {
                    return {...e._doc, _id: e._doc._id.toString()};
                });
            })
            .catch(err => {
                throw err;
            })
        },
        createEvent: (args, req) => {
            if (!req.isAuth) {
                throw new Error("Unauthenticated");
            }
            const event = new Event({
                // _id: Math.random().toString(),
                title: args.eventInput.title,
                description: args.eventInput.description,
                price: +args.eventInput.price,
                date: new Date(args.eventInput.date),
                creator: req.userId
            })
            // events.push(event);
            let createdEvent;
            return event.save()
            .then(res => {
                console.log(res);
                createdEvent =  {...res._doc, _id: res._doc._id.toString()}
                return User.findById(req.userId);
            })
            .then((user) => {
                if (!user) {
                    throw new Error("User not found");
                }
                user.createdEvents.push(event);
                return user.save();
            })
            .then((res) => {
                return createdEvent;
            })
            .catch(err => {
                console.log(err);
                throw err;
            })
        },
        createUser: (args) => {
            return User.findOne({
                email: args.userInput.email
            }).then((user) => {
                if (user) {
                    throw new Error("User already exists");
                }
                return bcrypt.hash(args.userInput.password, 12);
            }).then(hashedPassword => {
                const user = new User({
                    email: args.userInput.email,
                    password: hashedPassword
                });
                return user.save();
            })
            .then(result => {
                console.log("result");
                console.log(result);
                return {
                    ...result._doc,
                    password: null,
                    _id: result._doc._id.toString()
                }
            })
            .catch(err => {
                throw err;
            })
        },
        login: async ({ email, password }) => {
            const user = await User.findOne({ email: email });
            if (!user) {
                throw new Error("User not found");
            }
            const isEqual = await bcrypt.compare(password, user.password);
            if (!isEqual) {
                throw new Error("Password is incorrect");
            }

            const token = jwt.sign({
                userId: user.id,
                email: user.email
            },
            "secretKey",
            {
                expiresIn: "1h"
            });
            
            return {
                userId: user.id,
                token: token,
                tokenExpiration: 1
            }
        }
    },
    graphiql: true
}));

app.get("/", (req, res, next) => {
    res.send("Hello world!!");
});

app.listen(3000, () => {
    console.log("Server listening on port 3000");
})