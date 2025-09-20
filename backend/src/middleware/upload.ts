import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ImageUploadService } from '../services/imageUploadService.js';
import { AppError } from '../utils/errors.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const validation = ImageUploadService.validateImageFile(file);
  
  if (validation.isValid) {
    cb(null, true);
  } else {
    cb(new AppError(validation.error || 'Invalid file', 400));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files at once
  },
});

// Middleware for single image upload
export const uploadSingleImage = (fieldName: string = 'image') => {
  return upload.single(fieldName);
};

// Middleware for multiple image uploads
export const uploadMultipleImages = (fieldName: string = 'images', maxCount: number = 10) => {
  return upload.array(fieldName, maxCount);
};

// Middleware for mixed file uploads (multiple fields)
export const uploadMixedImages = (fields: { name: string; maxCount?: number }[]) => {
  return upload.fields(fields);
};

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    let message = 'Upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum size is 10MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum is 10 files.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      default:
        message = error.message;
    }
    
    return res.status(400).json({
      success: false,
      error: message,
    });
  }
  
  next(error);
};

// Middleware to process uploaded images and upload to Cloudinary
export const processImageUploads = (folder: string = 'smartstock/products') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Handle single file upload
      if (req.file) {
        const result = await ImageUploadService.uploadImage(req.file, folder);
        req.body.uploadedImage = {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        };
      }

      // Handle multiple files upload
      if (req.files && Array.isArray(req.files)) {
        const results = await ImageUploadService.uploadMultipleImages(req.files as Express.Multer.File[], folder);
        req.body.uploadedImages = results.map(result => ({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        }));
      }

      // Handle mixed files upload (multiple fields)
      if (req.files && !Array.isArray(req.files)) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        req.body.uploadedFiles = {};

        for (const [fieldName, fileArray] of Object.entries(files)) {
          if (fileArray && fileArray.length > 0) {
            const results = await ImageUploadService.uploadMultipleImages(fileArray, folder);
            req.body.uploadedFiles[fieldName] = results.map(result => ({
              url: result.secure_url,
              publicId: result.public_id,
              format: result.format,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
            }));
          }
        }
      }

      next();
    } catch (error) {
      next(new AppError(`Image processing failed: ${error}`, 500));
    }
  };
};