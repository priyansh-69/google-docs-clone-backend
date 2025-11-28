const express = require("express")
const router = express.Router()
const { verifyToken } = require("../middleware/authMiddleware")
const {
    createDocument,
    getUserDocuments,
    getDocument,
    deleteDocument,
    updateDocumentTitle,
    generateShareLink,
    disableShareLink,
    accessSharedDocument,
    addCollaborator,
    removeCollaborator
} = require("../controllers/documentController")
const {
    createDocumentValidation,
    updateDocumentTitleValidation,
    documentIdValidation
} = require("../middleware/validation")

// Public route for accessing shared documents
router.get("/:id/shared", accessSharedDocument)

// All other routes require authentication
router.use(verifyToken)

// Create a new document
router.post("/", createDocumentValidation, createDocument)

// Get all documents for the logged-in user
router.get("/", getUserDocuments)

// Get a single document by ID
router.get("/:id", documentIdValidation, getDocument)

// Update document title
router.patch("/:id/title", updateDocumentTitleValidation, updateDocumentTitle)

// Delete a document
router.delete("/:id", documentIdValidation, deleteDocument)

// Generate share link
router.post("/:id/share", documentIdValidation, generateShareLink)

// Disable share link
router.delete("/:id/share", documentIdValidation, disableShareLink)

// Add collaborator
router.post("/:id/collaborators", documentIdValidation, addCollaborator)

// Remove collaborator
router.delete("/:id/collaborators/:userId", removeCollaborator)

module.exports = router
