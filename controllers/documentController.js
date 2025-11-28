const Document = require("../Document")
const crypto = require("crypto")

// Create a new document
exports.createDocument = async (req, res) => {
    try {
        const { title, documentId } = req.body

        const document = new Document({
            _id: documentId,
            title: title || "Untitled Document",
            owner: req.user.id,
            collaborators: [],
            data: {}
        })

        await document.save()
        res.status(201).json(document)
    } catch (error) {
        console.error("Error creating document:", error)
        res.status(500).json({ message: "Failed to create document" })
    }
}

// Get all documents for the logged-in user
exports.getUserDocuments = async (req, res) => {
    try {
        const documents = await Document.find({
            $or: [
                { owner: req.user.id },
                { 'collaborators.user': req.user.id }
            ]
        })
            .sort({ createdAt: -1 })
            .select('_id title owner createdAt updatedAt')
            .populate('owner', 'username email')

        res.json(documents)
    } catch (error) {
        console.error("Error fetching documents:", error)
        res.status(500).json({ message: "Failed to fetch documents" })
    }
}

// Get a single document by ID
exports.getDocument = async (req, res) => {
    try {
        const { id } = req.params

        const document = await Document.findById(id)
            .populate('owner', 'username email')
            .populate('collaborators.user', 'username email')

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Check if user has permission to view
        const isOwner = document.owner._id.toString() === req.user.id
        const isCollaborator = document.collaborators.some(
            collab => collab.user._id.toString() === req.user.id
        )

        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ message: "Access denied" })
        }

        res.json(document)
    } catch (error) {
        console.error("Error fetching document:", error)
        res.status(500).json({ message: "Failed to fetch document" })
    }
}

// Delete a document
exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Only owner can delete
        if (document.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the owner can delete this document" })
        }

        await Document.findByIdAndDelete(id)
        res.json({ message: "Document deleted successfully" })
    } catch (error) {
        console.error("Error deleting document:", error)
        res.status(500).json({ message: "Failed to delete document" })
    }
}

// Update document title
exports.updateDocumentTitle = async (req, res) => {
    try {
        const { id } = req.params
        const { title } = req.body

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Check if user has permission to edit
        const isOwner = document.owner.toString() === req.user.id
        const hasEditorPermission = document.collaborators.some(
            collab => collab.user.toString() === req.user.id && collab.permission === 'editor'
        )

        if (!isOwner && !hasEditorPermission) {
            return res.status(403).json({ message: "Access denied" })
        }

        document.title = title
        await document.save()

        res.json(document)
    } catch (error) {
        console.error("Error updating document:", error)
        res.status(500).json({ message: "Failed to update document" })
    }
}

// Generate share link for document
exports.generateShareLink = async (req, res) => {
    try {
        const { id } = req.params
        const { permission } = req.body

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Only owner can generate share links
        if (document.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the owner can generate share links" })
        }

        // Validate permission
        if (!['viewer', 'editor'].includes(permission)) {
            return res.status(400).json({ message: "Invalid permission type" })
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex')

        document.shareLink = {
            token,
            permission,
            enabled: true,
            createdAt: new Date()
        }

        await document.save()

        const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/documents/${id}?share=${token}`

        res.json({
            shareUrl,
            token,
            permission,
            enabled: true
        })
    } catch (error) {
        console.error("Error generating share link:", error)
        res.status(500).json({ message: "Failed to generate share link" })
    }
}

// Disable share link
exports.disableShareLink = async (req, res) => {
    try {
        const { id } = req.params

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Only owner can disable share links
        if (document.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the owner can disable share links" })
        }

        if (document.shareLink) {
            document.shareLink.enabled = false
            await document.save()
        }

        res.json({ message: "Share link disabled successfully" })
    } catch (error) {
        console.error("Error disabling share link:", error)
        res.status(500).json({ message: "Failed to disable share link" })
    }
}

// Access document via share link
exports.accessSharedDocument = async (req, res) => {
    try {
        const { id } = req.params
        const { token } = req.query

        const document = await Document.findById(id)
            .populate('owner', 'username email')
            .populate('collaborators.user', 'username email')

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Verify share link
        if (!document.shareLink ||
            !document.shareLink.enabled ||
            document.shareLink.token !== token) {
            return res.status(403).json({ message: "Invalid or expired share link" })
        }

        res.json({
            ...document.toObject(),
            sharedPermission: document.shareLink.permission
        })
    } catch (error) {
        console.error("Error accessing shared document:", error)
        res.status(500).json({ message: "Failed to access shared document" })
    }
}

// Add collaborator to document
exports.addCollaborator = async (req, res) => {
    try {
        const { id } = req.params
        const { userId, permission } = req.body

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Only owner can add collaborators
        if (document.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the owner can add collaborators" })
        }

        // Check if user is already a collaborator
        const existingCollaborator = document.collaborators.find(
            collab => collab.user.toString() === userId
        )

        if (existingCollaborator) {
            return res.status(400).json({ message: "User is already a collaborator" })
        }

        document.collaborators.push({
            user: userId,
            permission: permission || 'viewer'
        })

        await document.save()
        await document.populate('collaborators.user', 'username email')

        res.json(document)
    } catch (error) {
        console.error("Error adding collaborator:", error)
        res.status(500).json({ message: "Failed to add collaborator" })
    }
}

// Remove collaborator from document
exports.removeCollaborator = async (req, res) => {
    try {
        const { id, userId } = req.params

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({ message: "Document not found" })
        }

        // Only owner can remove collaborators
        if (document.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the owner can remove collaborators" })
        }

        document.collaborators = document.collaborators.filter(
            collab => collab.user.toString() !== userId
        )

        await document.save()

        res.json({ message: "Collaborator removed successfully" })
    } catch (error) {
        console.error("Error removing collaborator:", error)
        res.status(500).json({ message: "Failed to remove collaborator" })
    }
}
