import { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useReportStatusWatcher() {
  const lastKnownStatus = useRef(new Map());

  useEffect(() => {
    let unsubscribeSnapshot = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(collection(db, "reports"), where("userId", "==", user.uid));
        
        // Listen to changes in reports
        unsubscribeSnapshot = onSnapshot(q, { includeMetadataChanges: false }, (snapshot) => {
          // Ignore local cache updates (pending writes) to avoid false triggers
          if (snapshot.metadata.hasPendingWrites) return;

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const doc = change.doc;
              const data = doc.data();
              const docId = doc.id;
              const newStatus = data.status;
              
              if (!newStatus) return;

              const prevStatus = lastKnownStatus.current.get(docId);

              if (!prevStatus) {
                // First time we've seen this report — just record it
                // don't fire a notification (avoids spam on first load)
                lastKnownStatus.current.set(docId, newStatus);
              } else if (prevStatus !== newStatus) {
                // Status genuinely changed — create notification
                lastKnownStatus.current.set(docId, newStatus);
                createStatusNotification(user.uid, data.reportId || docId, newStatus);
              }
            }
          });
        });
      } else {
        // User logged out, clear listeners and map
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        lastKnownStatus.current.clear();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);
  
  const createStatusNotification = async (userId, reportId, newStatus) => {
    let message = "";
    switch (newStatus) {
      case "Verified":
        message = `${reportId} has been verified by our team.`;
        break;
      case "In Progress":
        message = `${reportId} is now being acted upon by responders.`;
        break;
      case "Resolved":
        message = `${reportId} has been resolved. Thank you for your report!`;
        break;
      case "Pending":
        message = `${reportId} is pending review.`;
        break;
      default:
        message = `${reportId} status changed to ${newStatus}.`;
        break;
    }
    
    try {
      await addDoc(collection(db, "notifications"), {
        userId,
        reportId,
        title: "Report Status Updated",
        message,
        status: newStatus,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to write notification", e);
    }
  };
}

export const notifyReportSubmitted = async (userId, reportId) => {
  const message = `${reportId} has been submitted and is awaiting review.`;
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      reportId,
      title: "Report Submitted",
      message,
      status: "Pending",
      isRead: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Failed to write submitted notification", e);
  }
};
