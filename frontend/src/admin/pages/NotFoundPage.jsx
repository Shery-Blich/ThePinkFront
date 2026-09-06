import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="admin-error-container" style={{ minHeight: 'calc(100vh - 120px)', backgroundColor: 'transparent' }}>
      <div className="admin-error-card">
        <h1 className="admin-error-title">404 - שגיאה במנהלה! 📂</h1>
        <p className="admin-error-desc">
          העמוד שחיפשת לא נמצא ברשימות הוועדה. אולי הוא מעולם לא עודכן...
        </p>
        <Link 
          to="/questions" 
          className="admin-pink-btn"
          aria-label="חזרה ללוח השאלות"
        >
          חזרה ללוח השאלות
        </Link>
      </div>
    </div>
  );
}
