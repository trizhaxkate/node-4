# Project Summary

In this project we'll learn how to setup a very basic user authorization flow
using `express`. We'll learn proper hashing of passwords for security reasons,
and how to setup our database using `docker-compose`.

# Part 1 - Database Setup

We're going to be using `postgres` for this project as well. We'll use a
`docker-compose.yml` file to specify our configuration. Then we'll get the
required tables setup for our project.

## Step 1 - Writing our `docker-compose.yml` file

1. create a file named `docker-compose.yml`, open this file in your text editor.

   > This file uses the `yaml` format you can learn about the format
   > [here](https://learnxinyminutes.com/docs/yaml/).

2. On the first line of the file add

   ```yaml
   version: '3'
   ```

   This specifies the format version we're targeting with our file.

3. Next we add the `services` key.

   ```yaml
    version: '3'
    services:
   ```

   Services is where we'll define various different containers we wish to run or
   compose together for our project.

4. Now we'll define a service.

   ```yaml
   version: '3'
   services:
     db: # this is the service name
       image: postgres # this is the Docker image we want for this service
       environment: # We can set shell environment variables that will be passed to process
         POSTGRES_PASSWORD: node4db
       ports:
         - 5432:5432 # this binds ports from the container to the host system (your computer)
       volumes:
         - node3db:/var/lib/postgresql/data # binds a folder in the container to a specified volume
   volumes:
     node4db: # creates a volume (just data on disk) that docker manages for us.
   ```

   That's going to be all of the configuration we need for our database. We
   don't have any other docker containers to run as part of this project.

## Step 2 - Setup Database and Tables

1. Start the `postgres` instance with `docker-compose`

   ```sh
   docker-compose up -d db # -d will make this run in the background
   ```

2. Connect to the database using [SQLTabs](https://www.sqltabs.com/). Connection
   string will be...

   ```
   postgres://postgres@localhost:5432/postgres # password is node4db
   ```

   When connected, create a new database for our project...

   ```sql
   CREATE DATABASE node4db;
   ```

3. Let's create the necessary tables. We'll use proper migrations like in the
   last project.

   - Install `node-pg-migrate`

     ```sh
     npm install --save node-pg-migrate pg
     ```

   - Add configuration file for `node-pg-migrate`

     - Create a file at `config/default.json`

       ```json
       {
         "db": {
           "user": "postgres",
           "password": "node4db",
           "host": "localhost",
           "port": 5432,
           "database": "node4db"
         }
       }
       ```

   - Create a `users` table with the following columns

     - id
     - username
     - email
     - password

     If you need a reminder of how to create a migration, reference a previous
     project or refer to the
     [official documentation](https://github.com/salsita/node-pg-migrate/tree/master).

   - When your migration as been written, execute it with `npm run migrate up`

# Part 2 - Creating an authenticated API

## Step 1 - Setup your server

1. Like in previous projects, we're going to be utilizing `express` to build our
   API server. Get all of the boiler plate code required for a basic `express`
   server setup.

2. Let's create our first route

   - `POST /api/register`

     This will be the route that handles new user registration. It will need to
     handle the following data.

     - username
     - email
     - password

   > Don't forget to add any necessary middleware to handle json data in a post
   > request.

3. We're going to now create this user in the database, but we're going to be
   more proper in our handling of sensitive information such as the user's
   `password`. Instead of just saving the user password in plain text, we're
   going to hash the password making it much more difficult for a hacker to
   obtain login information for a user, even if they have access to our
   database.

   - First we need to install a package to help us utilize a cryptographically
     secure hashing algorithm. Unless you're a professional cryptographer it's
     almost always a bad idea to implement your own hashing algorithm.

     ```
     npm install --save argon2

     # let's also install massive for querying the database

     npm install --save massive
     ```

   - You'll now need to add `massive` to your `express` application. Refer to a
     previous project or the
     [official documentation](https://massivejs.org/docs/connecting) for help

   - Now, before we save this user to our database we have to be sure to
     properly hash their password, **WE NEVER WANT TO SAVE A PASSWORD IN PLAIN
     TEXT**.

     Here is an example of what the handler for the `register` endpoint could
     look like. This is still incomplete though because we have no way to login
     or maintain that subsequent request are authorized.

     ```js
     const argon2 = require('argon2');

     function register(req, res) {
       const db = req.app.get('db');
       const { username, email, password } = req.body;

       argon2
         .hash(password)
         .then(hash => {
           return db.users.insert(
             {
               username,
               email,
               password: hash,
             },
             {
               fields: ['id', 'username', 'email'], // never want to return the password hash
             }
           );
         })
         .then(user => res.status(201).json(user))
         .catch(err => {
           console.error(err);
           res.status(500).end();
         });
     }
     ```

4. We need a way to authorize our users, we're going to use **JSON Web Tokens**
   or **JWT** for identifying authorized users in our application.

   > Link:
   > [A quick intro to understanding JWT](https://medium.com/vandium-software/5-easy-steps-to-understanding-json-web-tokens-jwt-1164c0adfcec)
   >
   > More in depth: [Introducing JWT](https://jwt.io/introduction/)

   - We'll need a library to help us generate and verify JWT's.

     ```
     npm install --save jsonwebtoken
     ```

   - Now we'll need to generate a JWT token for the user after they successfully
     register. We're going to use an application secret for _signing_ the JWT we
     issue to users. The act of _signing_ to token will allow us to verify that
     we generated the token later. A secret is just a random String that will be
     unique to our application in our case we're going to just create our secret
     ourselves, but there are much more secure ways of creating application
     secrets.

     For simplicity let's just create a module that exports our application
     secret. Create a file at the root of the project named `secret.js`. All
     this file will contain is...

     ```js
     module.exports = '5up324pp11c4710n53c237';
     ```

     Now let's add this file the `.gitignore` file, since we don't want to
     expose our secret by committing it to our git repository.


     Here is the updated `register` handler we created previously.

     ```js
     const argon2 = require('argon2');
     const jwt = require('jsonwebtoken');

     function register(req, res) {
       const db = req.app.get('db');
       const { username, email, password } = req.body;

       argon2
         .hash(password)
         .then(hash => {
           return db.users.insert(
             {
               username,
               email,
               password: hash,
             },
             {
               fields: ['id', 'username', 'email'],
             }
           );
         })
         .then(user => {
           const token = jwt.sign({ userId: user.id }, secret); // adding token generation
           res.status(201).json({ ...user, token });
         })
         .catch(err => {
           console.error(err);
           res.status(500).end();
         });
     }
     ```

     Now when a user registers, we hash their password, save their data, and create a JWT
     token so they can make requests to API endpoints that are protected. But we don't have
     any API endpoints that are protected yet, we'll add a new endpoint that requires a valid
     JWT token in the next step.

5. Let's create an endpoint for our API that requires users to have a valid JWT
   token, and send it with their HTTP requests. Our API is going to require that
   clients send the token as part of the HTTP headers of the request. The
   `Authorization` header is what will be used. We will expect the format to
   look like the following...

   `Authorization: Bearer [user's token here]`

   - Endpoint `GET /api/protected/data`

   - Handler

     ```js
     function(req, res) {
      if (!req.headers.authorization) {
        return res.status(401).end();
      }

      try {
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, secret); // will throw an Error when token is invalid!!!
        res.status(200).json({ data: 'here is the protected data' });
      } catch (err) {
        console.error(err);
        res.status(401).end();
      }
     }
     ```

   Add this handler to your new endpoint and then test it to make sure it works
   as expected. The key part of the above example is.

   ```js
   jwt.verify(token, secret);
   ```

   This is where we check to make sure the token sent by the client was actually
   issued by our application. If the token was not issues by our application or
   it was tampered with by the client it will not pass our verification.

   You may be thinking this adds a lot of code to each request, having to parse
   headers and verify tokens, etc... and you're right. This functionality would
   be a greate candidate for implementing as `express` middleware. If you'd like
   to attempt to write a middleware for this functionality give it a try,
   remember though we only want this middleware to apply to endpoints that
   require authorization.

   > Middle Documentation:
   > https://expressjs.com/en/guide/writing-middleware.html

6. So we've created a way for users to register, we've also implemented a way to
   check if a request is authroized, but we still don't have a way for an
   existing user to login utilizing their username and password. In this step
   we'll create a `login` endpoint where we verify a user's username and
   password combination to see if they're a registered user, and also issue them
   a JWT so they can make subsequent authorized requests.

   - Endpoint: `POST /api/login`

   - **Handler:**

     The steps taken in this handler are as follows.

     1. Look up user by username (must be unique) in the database, if user
        cannot be found then username is incorrect.
     2. Next we verify that the submitted password hashes to the same value as
        the hashed password we have saved for this user in the database. If they
        do not match then the user has submitted an incorrect password.
     3. If `username` and `password` checks pass, we can issue the user a JWT
        and send back thier user data.
     4. If the authorized user want's to make additional requests they can send
        their JWT and we can verify they are authorized.

     ***

     ```js
     function login(req, res) {
       const db = req.app.get('db');
       const { username, password } = req.body;

       db.users
         .findOne(
           {
             username,
           },
           {
             fields: ['id', 'username', 'email', 'password'],
           }
         )
         .then(user => {
           if (!user) {
             throw new Error('Invalid username');
           }

           // Here is where we check the hashed password from the database
           // with the password that was submitted by the user.
           return argon2.verify(user.password, password).then(valid => {
             if (!valid) {
               throw new Error('Incorrect password');
             }

             const token = jwt.sign({ userId: user.id }, secret);
             delete user.password; // remove password hash from returned user object
             res.status(200).json({ ...user, token });
           });
         })
         .catch(err => {
           if (
             ['Invalid username', 'Incorrect password'].includes(err.message)
           ) {
             res.status(400).json({ error: err.message });
           } else {
             console.error(err);
             res.status(500).end();
           }
         });
     }
     ```

# Part 3 - Do it all again

Go back to the previous project [node-3](https://github.com/boomcamp/node-3) and
properly implement the user registration with password hashing. Then protect all
of the routes using JWT to authenticate users.

> **Bonus:** We haven't been placing constraints in our database (unique
> columns, etc...). In the node-3 project there are some tables that would need
> constraints to properly maintain the integrity of the data. See if you can
> identify and add the constraints that would help keep the data normalized.
>
> See:
> https://github.com/salsita/node-pg-migrate/blob/master/docs/constraints.md
