const bcrypt = require('bcryptjs');

const password = '123456';
const hash = '$2b$10$MMKnR5w34mp0DyMlEGJ0mOtxfHfaZzDLJ3v2KEOqtkg8KQtV.LR6i';

bcrypt.compare(password, hash).then(result => {
    console.log('Match:', result);
    if (!result) {
        bcrypt.hash(password, 10).then(newHash => {
            console.log('New suggested hash:', newHash);
        });
    }
});
