import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    getDocs,
    where,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let unsubscribeComplaints = null;
let teachers = [];
let selectedComplaintId = null;
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
        
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = { uid: user.uid, ...userDoc.data() };
        document.getElementById('userName').textContent = currentUser.name;
        
        // Load teachers and complaints
        await loadTeachers();
        loadAllComplaints();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        window.location.href = 'index.html';
    }
});

// Load teachers for assignment dropdown
async function loadTeachers() {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const snapshot = await getDocs(q);
        
        teachers = [];
        const teacherSelect = document.getElementById('teacherSelect');
        teacherSelect.innerHTML = '<option value="">Select Teacher for Manual Assignment</option>';
        
        snapshot.forEach((doc) => {
            const teacher = { id: doc.id, ...doc.data() };
            teachers.push(teacher);
            
            const option = document.createElement('option');
            option.value = teacher.uid;
            option.textContent = teacher.name;
            teacherSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

// Load and display all complaints with real-time updates
function loadAllComplaints() {
    // Create query for all complaints
    const q = query(
        collection(db, 'complaints'),
        orderBy('createdAt', 'desc')
    );
    
    // Listen for real-time updates
    unsubscribeComplaints = onSnapshot(q, (snapshot) => {
        const complaintsDiv = document.getElementById('complaintsList');
        
        if (snapshot.empty) {
            complaintsDiv.innerHTML = '<p class="empty-state">No complaints submitted yet.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach((doc) => {
            const complaint = { id: doc.id, ...doc.data() };
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
        'Unknown';
    
    const assignedInfo = complaint.assignedTeacherName ? 
        `<p><strong>Assigned to:</strong> ${complaint.assignedTeacherName}</p>` : 
        '<p><strong>Status:</strong> Unassigned</p>';
    
    const responseSection = complaint.response ? 
        `<div class="complaint-response">
            <strong>Teacher Response:</strong>
            <p>${complaint.response}</p>
        </div>` : '';
    
    const assignButton = complaint.status === 'pending' ? 
        `<button class="btn btn-warning" onclick="selectForAssignment('${complaint.id}')">
            Select for Assignment
        </button>` : '';
    
    return `
        <div class="complaint-item ${selectedComplaintId === complaint.id ? 'selected' : ''}">
            <div class="complaint-header">
                <div>
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-meta">
                        Student: ${complaint.studentName} | 
                        Submitted: ${createdAt}
                    </div>
                </div>
                <span class="complaint-status status-${complaint.status}">${complaint.status}</span>
            </div>
            <div class="complaint-description">${complaint.description}</div>
            ${assignedInfo}
            ${responseSection}
            ${assignButton}
        </div>
    `;
}

// Select complaint for assignment
window.selectForAssignment = function(complaintId) {
    selectedComplaintId = complaintId;
    // Re-render to show selection
    const items = document.querySelectorAll('.complaint-item');
    items.forEach(item => item.classList.remove('selected'));
    
    // Add selected class to current item
    const selectedItem = document.querySelector(`[onclick="selectForAssignment('${complaintId}')"]`).closest('.complaint-item');
    selectedItem.classList.add('selected');
};

// Assign complaint using FCFS (First Come, First Served)
window.assignFCFS = async function() {
    if (teachers.length === 0) {
        showMessage('No teachers available for assignment.', 'error');
        return;
    }
    
    try {
        // Use Firestore transaction for atomic FCFS assignment
        await runTransaction(db, async (transaction) => {
            // Get the oldest unassigned complaint
            const q = query(
                collection(db, 'complaints'),
                where('status', '==', 'pending'),
                orderBy('createdAt', 'asc')
            );
            
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                throw new Error('No pending complaints to assign.');
            }
            
            // Get first (oldest) complaint
            const oldestComplaint = snapshot.docs[0];
            const complaintRef = doc(db, 'complaints', oldestComplaint.id);
            
            // Assign to first teacher (simple FCFS logic)
            const assignedTeacher = teachers[0];
            
            // Update complaint
            transaction.update(complaintRef, {
                assignedTeacherId: assignedTeacher.uid,
                assignedTeacherName: assignedTeacher.name,
                status: 'assigned',
                assignedAt: serverTimestamp()
            });
        });
        
        showMessage('Complaint assigned successfully using FCFS!', 'success');
        selectedComplaintId = null;
        
    } catch (error) {
        console.error('Error assigning complaint:', error);
        showMessage(error.message || 'Error assigning complaint.', 'error');
    }
};

// Assign complaint manually to selected teacher
window.assignManual = async function() {
    const teacherSelect = document.getElementById('teacherSelect');
    const selectedTeacherId = teacherSelect.value;
    
    if (!selectedComplaintId) {
        showMessage('Please select a complaint first.', 'error');
        return;
    }
    
    if (!selectedTeacherId) {
        showMessage('Please select a teacher.', 'error');
        return;
    }
    
    try {
        const selectedTeacher = teachers.find(t => t.uid === selectedTeacherId);
        
        // Update complaint document
        await updateDoc(doc(db, 'complaints', selectedComplaintId), {
            assignedTeacherId: selectedTeacherId,
            assignedTeacherName: selectedTeacher.name,
            status: 'assigned',
            assignedAt: serverTimestamp()
        });
        
        showMessage(`Complaint assigned to ${selectedTeacher.name} successfully!`, 'success');
        selectedComplaintId = null;
        teacherSelect.value = '';
        
    } catch (error) {
        console.error('Error assigning complaint:', error);
        showMessage('Error assigning complaint. Please try again.', 'error');
    }
};

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
    
    // Add to dashboard content
    document.querySelector('.dashboard-content').insertBefore(
        messageDiv, 
        document.querySelector('.card')
    );
    
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