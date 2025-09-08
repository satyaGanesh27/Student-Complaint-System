import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let unsubscribeComplaints = null;

// Global logout function
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

// Check authentication and load user data
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Get user document to verify role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists() || userDoc.data().role !== 'student') {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = { uid: user.uid, ...userDoc.data() };
        document.getElementById('userName').textContent = currentUser.name;
        
        // Load student's complaints
        loadComplaints();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        window.location.href = 'index.html';
    }
});

// Handle complaint form submission
document.getElementById('complaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    
    try {
        // Create new complaint document
        await addDoc(collection(db, 'complaints'), {
            title: title,
            description: description,
            studentId: currentUser.uid,
            studentName: currentUser.name,
            status: 'pending',
            assignedTeacherId: null,
            assignedTeacherName: null,
            response: '',
            createdAt: serverTimestamp(),
            assignedAt: null,
            resolvedAt: null
        });
        
        // Clear form
        document.getElementById('complaintForm').reset();
        
        // Show success message
        showMessage('Complaint submitted successfully!', 'success');
        
    } catch (error) {
        console.error('Error submitting complaint:', error);
        showMessage('Error submitting complaint. Please try again.', 'error');
    }
});

// Load and display student's complaints with real-time updates
function loadComplaints() {
    if (!currentUser) return;
    
    // Create query for student's complaints
    const q = query(
        collection(db, 'complaints'),
        where('studentId', '==', currentUser.uid)
    );
    
    // Listen for real-time updates
    unsubscribeComplaints = onSnapshot(q, (snapshot) => {
        const complaintsDiv = document.getElementById('complaintsList');
        
        if (snapshot.empty) {
            complaintsDiv.innerHTML = '<p class="empty-state">No complaints submitted yet.</p>';
            return;
        }
        
        // Convert to array and sort by creation time (newest first)
        const complaints = [];
        snapshot.forEach((doc) => {
            const complaint = { id: doc.id, ...doc.data() };
            complaints.push(complaint);
        });
        
        // Sort by createdAt (newest first)
        complaints.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt.seconds - a.createdAt.seconds;
        });
        
        let html = '';
        complaints.forEach((complaint) => {
            html += renderComplaintItem(complaint);
        });
        
        complaintsDiv.innerHTML = html;
    }, (error) => {
        console.error('Error loading complaints:', error);
        document.getElementById('complaintsList').innerHTML = 
            '<p class="error-message" style="display: block;">Error loading complaints.</p>';
    });
}

// Render individual complaint item
function renderComplaintItem(complaint) {
    const createdAt = complaint.createdAt ? 
        new Date(complaint.createdAt.seconds * 1000).toLocaleDateString() : 
        'Just now';
    
    const assignedInfo = complaint.assignedTeacherName ? 
        `<p><strong>Assigned to:</strong> ${complaint.assignedTeacherName}</p>` : '';
    
    const responseSection = complaint.response ? 
        `<div class="complaint-response">
            <strong>Teacher Response:</strong>
            <p>${complaint.response}</p>
        </div>` : '';
    
    return `
        <div class="complaint-item">
            <div class="complaint-header">
                <div>
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-meta">Submitted: ${createdAt}</div>
                </div>
                <span class="complaint-status status-${complaint.status}">${complaint.status}</span>
            </div>
            <div class="complaint-description">${complaint.description}</div>
            ${assignedInfo}
            ${responseSection}
        </div>
    `;
}

// Show success/error messages
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    // Add to form
    document.getElementById('complaintForm').appendChild(messageDiv);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeComplaints) {
        unsubscribeComplaints();
    }
});