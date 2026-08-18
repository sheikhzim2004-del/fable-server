require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const PORT = process.env.SERVER_PORT;
const MONGODB_URI = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();

        // Connect to the "fable_db" database and access its "books" collection
        const database = client.db("fable_db");
        const booksCollection = database.collection("books");

        app.post('/api/books', async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result)
        })
        app.get('/api/books', async (req, res) => {
            const { writerId } = req.query;
            const query = writerId ? { writerId } : {};
            const books = await booksCollection.find(query).toArray();
            res.send(books);
        });
        app.get('/api/books/:id', async (req, res) => {
            const id = req.params.id;

            const book = await booksCollection.findOne({
                _id: new ObjectId(id)
            });

            res.send(book);
        });
        app.put('/api/books/:id', async (req, res) => {
            const id = req.params.id;
            const updatedBook = req.body;

            delete updatedBook._id; // _id kokhono update payload এ pathano thik na.

            const result = await booksCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedBook }
            );
            res.send(result);
        });

        app.delete('/api/books/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const result = await booksCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                if (result.deletedCount === 0) {
                    return res.status(404).send({
                        error: "Book not found"
                    });
                }

                res.send({
                    success: true,
                    message: "Book deleted successfully"
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    error: "Failed to delete book"
                });
            }
        });




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('the server site is working')
})



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})