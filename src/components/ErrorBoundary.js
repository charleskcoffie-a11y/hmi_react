import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#fff', background: '#3b0f1c' }}>
          <h3>Something went wrong.</h3>
          <p>Please save your work and reload the editor.</p>
        </div>
      );
    }
    return this.props.children;
  }
}