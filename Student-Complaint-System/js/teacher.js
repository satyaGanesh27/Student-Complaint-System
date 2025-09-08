import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    serverTimestamp
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
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists() || userDoc.data().role !== 'teacher') {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = { uid: user.uid, ...userDoc.data() };
        document.getElementById('userName').textContent = currentUser.name;
        
        // Load assigned complaints
        loadAssignedComplaints();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        window.location.href = 'index.html';
    }
});

// Load and display assigned complaints (sort in JS)
function loadAssignedComplaints() {
    if (!currentUser) return;
    
    const q = query(
        collection(db, 'complaints'),
        where('assignedTeacherId', '==', currentUser.uid)
    );
    
    unsubscribeComplaints = onSnapshot(q, (snapshot) => {
        const complaintsDiv = document.getElementById('complaintsList');
        
        if (snapshot.empty) {
            complaintsDiv.innerHTML = '<p class="empty-state">No complaints assigned to you yet.</p>';
            return;
        }
        
        // Collect complaints in an array
        const complaintsArray = [];
        snapshot.forEach(doc => complaintsArray.push({ id: doc.id, ...doc.data() }));
        
        // Sort by assignedAt descending (most recent first)
        complaintsArray.sort((a, b) => {
            const aTime = a.assignedAt?.seconds || 0;
            const bTime = b.assignedAt?.seconds || 0;
            return bTime - aTime;
        });
        
        complaintsDiv.innerHTML = complaintsArray.map(renderComplaintItem).join('');
    }, (error) => {
        console.error('Error loading complaints:', error);
        document.getElementById('complaintsList').innerHTML = 
            '<p class="error-message" style="display: block;">Error loading complaints.</p>';
    });
}

// Render individual complaint item
function renderComplaintItem(complaint) {
    const createdAt = complaint.createdAt ? 
        new Date(complaint.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';
    
    const assignedAt = complaint.assignedAt ? 
        new Date(complaint.assignedAt.seconds * 1000).toLocaleDateString() : 'Unknown';
    
    const responseForm = complaint.status !== 'resolved' ? 
        `<div class="response-form">
            <textarea id="response-${complaint.id}" placeholder="Write your response here..." rows="3">${complaint.response || ''}</textarea>
            <button class="btn btn-success" onclick="resolveComplaint('${complaint.id}')">
                Mark as Resolved
            </button>
        </div>` : '';
    
    const responseSection = complaint.response ? 
        `<div class="complaint-response">
            <strong>Your Response:</strong>
            <p>${complaint.response}</p>
        </div>` : '';
    
    return `
        <div class="complaint-item">
            <div class="complaint-header">
                <div>
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-meta">
                        Student: ${complaint.studentName} | 
                        Submitted: ${createdAt} | 
                        Assigned: ${assignedAt}
                    </div>
                </div>
                <span class="complaint-status status-${complaint.status}">${complaint.status}</span>
            </div>
            <div class="complaint-description">${complaint.description}</div>
            ${responseSection}
            ${responseForm}
        </div>
    `;
}

// Resolve complaint with response
window.resolveComplaint = async function(complaintId) {
    const responseTextarea = document.getElementById(`response-${complaintId}`);
    const response = responseTextarea.value.trim();
    
    if (!response) {
        alert('Please provide a response before marking as resolved.');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'complaints', complaintId), {
            response: response,
            status: 'resolved',
            resolvedAt: serverTimestamp()
        });
        
        showMessage('Complaint resolved successfully!', 'success');
        
    } catch (error) {
        console.error('Error resolving complaint:', error);
        showMessage('Error resolving complaint. Please try again.', 'error');
    }
};

// Show success/error messages
function showMessage(message, type) {
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    document.querySelector('.dashboard-content').insertBefore(
        messageDiv, 
        document.querySelector('.card')
    );
    
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
