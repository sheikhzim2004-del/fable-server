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
        const paymentCollection = database.collection("payment");

        app.post('/api/books', async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result)
        })
        app.post('/payment', async (req, res) => {
            const { price, userId, bookId, title, session_id } = req.body;

            const isExistSession = await paymentCollection.findOne({ session_id })
            if (isExistSession) {
                return res.status(400).send({ message: "Session already exist" })
            }

            const pay_result = await paymentCollection.insertOne({
                userId,
                session_id,
                price: Number(price),
                title,
                bookId
            })
            res.send(pay_result)
        })
        app.get('/api/books', async (req, res) => {
            const { writerId } = req.query;
            const query = writerId ? { writerId } : {};
            const books = await booksCollection.find(query).toArray();
            res.send(books);
        });
        // চেক করা: নির্দিষ্ট ইউজার নির্দিষ্ট বইটি কিনেছে কি না
        app.get('/payment/check', async (req, res) => {
            const { userId, bookId } = req.query;

            if (!userId || !bookId) {
                return res.status(400).send({ message: "userId and bookId are required" });
            }

            const payment = await paymentCollection.findOne({
                userId: String(userId),
                bookId: String(bookId),
            });

            res.send({ isPurchased: !!payment }); // payment record thakle true pathabe !! ata diye payment kea boleean kora hoiche
        });
        app.get('/api/books/:id', async (req, res) => {
            const id = req.params.id;

            const book = await booksCollection.findOne({
                _id: new ObjectId(id)
            });

            res.send(book);
        });
        // ইউজারের কেনা সব বইয়ের তালিকা (User Dashboard-এর জন্য)
        app.get('/payments/user/:userId', async (req, res) => {
            const { userId } = req.params;
            const result = await paymentCollection.find({ userId: String(userId) }).toArray();
            res.send(result);
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