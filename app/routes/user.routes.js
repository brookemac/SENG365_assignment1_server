const users = require('../controllers/user.controller');

module.exports = function(app) {

    app.route(app.rootUrl + '/users/register')
        .post(users.createUser)

    app.route(app.rootUrl + '/users/login')
        .post(users.loginUser)

    app.route(app.rootUrl + '/users/logout')
        .post(users.logoutUser)

    app.route(app.rootUrl + '/users/:id')
        .get(users.getUser)
        .patch(users.updateUser)

    app.route(app.rootUrl + '/users/:id/image')
        .get(users.getUserImage)
        .put(users.setUserImage)
        .delete(users.deleteUserImage);

};