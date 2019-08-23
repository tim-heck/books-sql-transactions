const express = require('express');
const router = express.Router();

const pool = require('../modules/pool');

// Get all books and associated tags
router.get('/', (req, res) => {
  let queryText = 
      // Using LEFT JOIN because not all books have tags & want all
      // array_agg w/ GROUP BY gathers all tags for a book into an array
      `SELECT books.id, title, author, array_agg(tags.name) as tags FROM books
        LEFT JOIN books_tags on books_tags.book_id = books.id
        LEFT JOIN tags on tags.id = books_tags.tag_id
        GROUP BY books.id 
        ORDER BY title;`;
  pool.query(queryText).then(result => {
    // Sends back the results in an object
    res.send(result.rows);
  })
  .catch(error => {
    console.log('error getting books', error);
    res.sendStatus(500);
  });
});

// Adds a new book
// Request body must be a book object with a title and author
//   may include array of tags
router.post('/', async (req, res) => {

  // TODO 3 - update this POST to use async/await and 
  // a transaction to insert both the new book
  // as well as associate the tags to the new book by 
  // adding rows to books_tags table (M-M relationship)
  const client = await pool.connect();

  try {
    let newBook = req.body;
    console.log(`Adding book`, newBook);
    await client.query('BEGIN')

    const bookInsertDetails = await client.query(`
      INSERT INTO "books" ("author", "title")
      VALUES ($1, $2) RETURNING id;`, 
      [newBook.author, newBook.title]);
    const bookId = bookInsertDetails.rows[0].id;
    console.log('New book id:', bookId);

    await client.query(`
      INSERT INTO "books_tags" ("book_id", "tag_id")
      VALUES ($1, $2);`,
      [bookId, req.body.tags[0].id]);

    await client.query('COMMIT');
    res.sendStatus(201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(`Error adding new book`, err);
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

module.exports = router;
