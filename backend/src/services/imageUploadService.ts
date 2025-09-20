import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
}

export class ImageUploadService {
  /**
   * Upload image to Cloudinary
   */
  static async uploadImage(
    file: Express.Multer.File,
    folder: string = 'smartstock',
    transformation?: any
  ): Promise<CloudinaryUploadResult> {
    try {
      const options: any = {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        max_bytes: 10 * 1024 * 1024, // 10MB limit
      };

      if (transformation) {
        options.transformation = transformation;
      }

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result as CloudinaryUploadResult);
            }
          }
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      throw new Error(`Image upload failed: ${error}`);
    }
  }

  /**
   * Upload multiple images
   */
  static async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'smartstock'
  ): Promise<CloudinaryUploadResult[]> {
    const uploadPromises = files.map(file => 
      this.uploadImage(file, folder)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new Error(`Image deletion failed: ${error}`);
    }
  }

  /**
   * Delete multiple images
   */
  static async deleteMultipleImages(publicIds: string[]): Promise<void> {
    const deletePromises = publicIds.map(publicId => 
      this.deleteImage(publicId)
    );

    await Promise.all(deletePromises);
  }

  /**
   * Generate product image transformations
   */
  static getProductImageTransformations() {
    return {
      thumbnail: {
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto',
        format: 'webp',
      },
      medium: {
        width: 400,
        height: 400,
        crop: 'fit',
        quality: 'auto',
        format: 'webp',
      },
      large: {
        width: 800,
        height: 800,
        crop: 'fit',
        quality: 'auto',
        format: 'webp',
      },
    };
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  static extractPublicId(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0];
  }

  /**
   * Generate optimized image URLs
   */
  static generateImageUrls(publicId: string, folder: string = 'smartstock') {
    const transformations = this.getProductImageTransformations();
    
    return {
      original: cloudinary.url(`${folder}/${publicId}`),
      thumbnail: cloudinary.url(`${folder}/${publicId}`, {
        transformation: transformations.thumbnail,
      }),
      medium: cloudinary.url(`${folder}/${publicId}`, {
        transformation: transformations.medium,
      }),
      large: cloudinary.url(`${folder}/${publicId}`, {
        transformation: transformations.large,
      }),
    };
  }

  /**
   * Validate image file
   */
  static validateImageFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size too large. Maximum size is 10MB.',
      };
    }

    return { isValid: true };
  }
}