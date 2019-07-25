exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    username: 'text',
    email: 'text',
    password: 'text',
  })
};

