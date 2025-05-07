
import express from "express"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import cors from "cors"
import multer from "multer"
import sharp from "sharp"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import crypto, { randomBytes } from "crypto"

dotenv.config()


const app = express()

const PORT = process.env.PORT || 5000;



// env variables 
const AWS_ACCESS_KEY= process.env.AWS_ACCESS_KEY
const AWS_SECRETE_ACCESS_KEY= process.env.AWS_SECRETE_ACCESS_KEY
const AWS_BUCKET_REGION=process.env.BUCKET_REGION
const AWS_BUCKET_NAME= process.env.BUCKET_NAME


 // create an S3 instance 
         const s3 = new S3Client({
            credentials: {
                accessKeyId: AWS_ACCESS_KEY,
                secretAccessKey: AWS_SECRETE_ACCESS_KEY
            },
              region: AWS_BUCKET_REGION
        })

// setting corse options
const corsOptions = {
    origin:"*",
    methods: ["GET","HEAD","PUT","PATCH","POST","DELETE"],
    credentials: true, // Enable credentials (cookies, authorization headers, etc.)
}


//Middleware
app.use(cookieParser())
app.use(express.json())
app.use(cors(corsOptions))


// setting up multer storage 
const storage = multer.memoryStorage()
const upload = multer({
    storage: storage
})


// api routes
app.post("/api/post", upload.single("image"), async (req, res) => { 
    try {
     /// resize the image 
        const imageResizeBuffer =  await sharp(req.file.buffer).resize({
            height:1920,
            width: 1080,
            fit: "contain"
        }).toBuffer()
          // create a random image name to avoid image conflicting
        const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex') 

 
const imagePrefix= randomImageName()
         // describe the properties of the file meant to be sent to the saver
const params = {
    Bucket: AWS_BUCKET_NAME,
    Key: `${imagePrefix}-${req.file.originalname}`,
    Body: imageResizeBuffer,
    ContentType: req.file.mimetype,
}

    // create a new instance of the PutObjectCommand
const command = new PutObjectCommand(params)
    const data = await s3.send(command)
    
res.status(200).json({
    file: data,
    imageUrl: `${imagePrefix}-${req.file.originalname}`,
    message: "upload successful"
      })
  } catch (error) {
    throw new Error(error)
  }
})


// get a single image
app.post("/api/get", async(req, res) => { 
    const { imageName } = req.body
    const getObjectParams = {
        Bucket: AWS_BUCKET_NAME,
        Key: imageName
    }
    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, {
        expiresIn: 3600
    })
    return res.status(200).json({ 
        imageUrl: url
    })
})

// delete a single image

app.delete("/api/deleteImage", async(req, res) => { 
    const { imageName } = req.body
    const deleteObjectParams = {
        Bucket: AWS_BUCKET_NAME,
        Key: imageName
    }
    const command = new DeleteObjectCommand(deleteObjectParams);
  const result=  await s3.send(command)
    return res.status(200).json({ 
        message: "Image deleted successfully",
        result
    })
})



app.use((req, res, next) => {
    res.status(404).json({
        message:"route not found"
    })
})

/* handling all errors */
app.use((err, req, res, next) => {
    const errorMessage = err.message
    // the stack property tells what area in the application the error happenz
    const stack = err.stack
res.status(500).json({
    message: errorMessage,
    stack
})

})


app.listen(PORT, async() => { 
    try {
        console.log("DB connect and server running on port "+ PORT)
    } catch (error) {
        console.log("Failed to start server " + error.message)
        process.exit()
    }
})