import { Router } from 'express';
import { uploadDocument, listDocuments, getDocument, deleteDocument } from '../controllers/document.controller.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { documentIdParam } from '../schemas/document.schema.js';

const router = Router();
router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.get('/:id', validate({ params: documentIdParam }), getDocument);
router.delete('/:id', validate({ params: documentIdParam }), deleteDocument);

export default router;
