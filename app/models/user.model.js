const db = require('../../config/db');
const bcrypt = require('bcrypt');
const saltRounds = 10;
var fs = require('mz/fs');
var mime = require('mime-types');

const imagePath = './storage/images/';


exports.createUser = async function(first_name, last_name, email, password) {
    console.log(`Request to create a new user for the database`);

    const conn = await db.getPool().getConnection();

    const queryUser = 'SELECT * FROM user WHERE email = ?';
    const [user] = await conn.query(queryUser, [email]);

    if (!email.includes('@') || user.length !== 0 || password === undefined || password === "" || first_name === undefined || first_name === "") {
        conn.release();
        return 400;
    } else {
        const hashPassword = await bcrypt.hash(password, saltRounds);
        const query = 'INSERT INTO user (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
        const [result] = await conn.query(query, [first_name, last_name, email, hashPassword]);
        conn.release();
        return {userId: result.insertId};
    }
};


exports.loginUser = async function(email, password) {
    console.log(`Request to log in user from the database`);

    const conn = await db.getPool().getConnection();

    const userQuery = 'SELECT * FROM user WHERE email = ?';
    const [user] = await conn.query(userQuery, [email]);

    if (email === undefined || !email.includes('@') || password === undefined || user.length === 0 
        || !(await bcrypt.compare(password, user[0].password))) {
        conn.release();
        return 400;
    } else {
        const user_id = user[0].id;
        const token = Math.random().toString(36).substr(2);

        const addTokenQuery = 'UPDATE user SET auth_token = ? WHERE id = ?';
        const result = conn.query(addTokenQuery, [token, user_id]);
        conn.release();

        console.log("a")

        return {userId: user_id, token: token};
    }
};

exports.logoutUser = async function(auth_token) {

    console.log(`Request to log out user from the database`);

    const conn = await db.getPool().getConnection();

    const queryUser = 'SELECT * FROM user WHERE auth_token = ?';
    const [user] = await conn.query(queryUser, [auth_token]);

    console.log(user);

    if (user.length === 0) {
        conn.release();
        return 401;
    } else {
        const user_id = user[0].id;
        console.log(user_id);
        const tokenQuery = 'UPDATE user SET auth_token = NULL WHERE id = ?';
        const result = conn.query(tokenQuery, [user_id]);
        conn.release();
        return 200;
    }
};


exports.getUser = async function(id, auth_token) {
    console.log(`Request to get user ${id} from the database`);

    const conn = await db.getPool().getConnection();

    const userQuery = 'SELECT * FROM user WHERE id = ?';
    const [user] = await conn.query(userQuery, [id]);
    conn.release();

    if (user.length === 0) {
        return 404;
    } else if (user[0].auth_token === auth_token) {
        return {firstName: user[0].first_name, lastName: user[0].last_name, email: user[0].email};
    } else {
        return {firstName: user[0].first_name, lastName: user[0].last_name};
    }
};


exports.updateUser = async function(id, first_name, last_name, email, password, current_password, auth_token) {
    console.log(`Request to update user ${id} from the database`);

    const conn = await db.getPool().getConnection();

    const userQuery = "SELECT * FROM user WHERE id = ?";
    const [user] = await conn.query(userQuery, [id]);

    if (user.length === 0 ) {
        conn.release();
        return 404;
    }

    const requestingQuery = "SELECT * FROM user WHERE auth_token = ?";
    const [userRequesting] = await conn.query(requestingQuery, [auth_token]);

    const emailQuery = "SELECT * FROM user WHERE email = ?";
    const [userEmail] = await conn.query(emailQuery, [email]);

    if (password == "") {
        password = undefined
    }

    let first = true;
    let query = 'UPDATE user SET';
    if (first_name !== undefined) {
        if (first) {
            first = false;
        } else {
            query += ','
        }
        query += ' first_name = "' + first_name + '"';
    }
    if (last_name !== undefined) {
        if (first) {
            first = false;
        } else {
            query += ','
        }
        query += ' last_name = "' + last_name + '"';
    }
    if (email !== undefined) {
        if (first) {
            first = false;
        } else {
            query += ','
        }
        query += ' email = "' + email + '"';
    }
    if (password !== undefined) {
        if (first) {
            first = false;
        } else {
            query += ','
        }
        const hashPassword = await bcrypt.hash(password, saltRounds);
        query += ' password = "' + hashPassword + '"';
    }

    query += ' WHERE id = ?';

    console.log(query)

    if ((email !== undefined && !email.includes('@')) || first === true) {
        conn.release();
        return 400; //Bad request
    } else if (userRequesting.length === 0 || (password !== undefined && password !== current_password && !(await bcrypt.compare(current_password, user[0].password)))) {
        conn.release();
        return 401; // Unauthorized
    } else if ((userEmail.length !== 0 && userEmail[0].id !== id) || user[0].auth_token !== userRequesting[0].auth_token) {
        conn.release();
        return 403; // Forbidden
    }

    const [result] = await conn.query(query, [id]);
    conn.release();
    return [result];

};



exports.getUserImage = async function(id) {
    console.log(`Request to get user ${id} image from the database`)

    const conn = await db.getPool().getConnection();

    const userQuery = 'SELECT * FROM user WHERE id = ?';
    const [user] = await conn.query(userQuery, [id]);
    conn.release();

    if (user.length === 0) {
        return 404;
    } else {
        const filename = user[0].image_filename;

        console.log(imagePath + filename);

        if (await fs.exists(imagePath + filename)) {
            const image = await fs.readFile(imagePath + filename);
            console.log(image)
            const mimeType = mime.lookup(filename);
            return {image, mimeType};
        } else {
            return 404; //image not found
        }
    
    }
};


exports.setUserImage = async function(id, auth_token, content_type, image) {
    console.log(`Request to set image for user ${id}`);

    const conn = await db.getPool().getConnection();

    const userQuery = 'SELECT * FROM user WHERE id = ?';
    const [user] = await conn.query(userQuery, [id]);

    const requestingQuery = 'SELECT * FROM user WHERE auth_token = ?';
    const [userRequesting] = await conn.query(requestingQuery, [auth_token]);

    conn.release();

    if (user.length === 0) {
        return 404;
    } else if (userRequesting.length === 0) {
        return 401;
    } else if (user[0].id !== userRequesting[0].id) {
        return 403;
    } else if (content_type !== "image/jpeg" && content_type !== "image/png" && content_type !== "image/gif") {
        return 400;
    } else {
        let imageType = '.' + content_type.slice(6);
        let filename = "user_" + id + imageType;
        fs.writeFile(imagePath + filename, image);

        const conn2 = await db.getPool().getConnection();
        const query = 'UPDATE user SET image_filename = ? WHERE id = ?';
        const [result] = await conn2.query(query, [filename, id]);
        conn2.release();

        if (user[0].image_filename === null) {
            return 201;
        } else {
            return 200;
        }
    }
};

exports.deleteUserImage = async function(id, auth_token) {
    console.log(`Request to delete image for user ${id}`);

    const conn = await db.getPool().getConnection();

    const userQuery = 'SELECT * FROM user WHERE id = ?';
    const [user] = await conn.query(userQuery, [id]);
    
    const requestingQuery = 'SELECT * FROM user WHERE auth_token = ?';
    const [userRequesting] = await conn.query(requestingQuery, [auth_token]);

    conn.release();

    if (user.length === 0) {
        return 404;
    } else if (userRequesting.length === 0) {
        return 401;
    } else if (user[0].id !== userRequesting[0].id) {
        return 403;
    } else {
        const conn2 = await db.getPool().getConnection();
        const query = 'UPDATE user SET image_filename = NULL WHERE id = ?';
        const [result] = await conn2.query(query, [id]);
        conn2.release();
        return 200;
    }
};