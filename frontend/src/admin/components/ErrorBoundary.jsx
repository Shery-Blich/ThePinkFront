/* eslint-disable react/prop-types */
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-error-container">
          <div className="admin-error-card">
            <h1 className="admin-error-title">תקלה טכנית בוועדה! ⚠️</h1>
            <p className="admin-error-desc">
              שלומי מעד על כבלי השרת... אל דאגה, אנחנו מטפלים בזה.
            </p>
            <button 
              onClick={this.handleReload} 
              className="admin-pink-btn"
              aria-label="טען מחדש את העמוד"
            >
              טען מחדש את העמוד
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
