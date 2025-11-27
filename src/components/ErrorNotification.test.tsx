/**
 * Tests for ErrorNotification component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorNotification from './ErrorNotification';
import type { ErrorItem } from '../types/error';

describe('ErrorNotification', () => {
  it('should render nothing when errors array is empty', () => {
    const { container } = render(
      <ErrorNotification errors={[]} onDismiss={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render single error message', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test error message', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={vi.fn()} />);

    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render multiple error messages', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'First error', type: 'error' },
      { id: 2, message: 'Second error', type: 'error' },
      { id: 3, message: 'Third error', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={vi.fn()} />);

    expect(screen.getByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.getByText('Third error')).toBeInTheDocument();
  });

  it('should apply correct CSS class based on error type', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Error message', type: 'error' },
      { id: 2, message: 'Success message', type: 'success' },
      { id: 3, message: 'Warning message', type: 'warning' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    const notifications = container.querySelectorAll('.error-notification');
    expect(notifications[0]).toHaveClass('error');
    expect(notifications[1]).toHaveClass('success');
    expect(notifications[2]).toHaveClass('warning');
  });

  it('should call onDismiss with correct id when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test error', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('should call onDismiss with correct id for specific error', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const errors: ErrorItem[] = [
      { id: 1, message: 'First error', type: 'error' },
      { id: 2, message: 'Second error', type: 'error' },
      { id: 3, message: 'Third error', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={onDismiss} />);

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss error/i });

    // Click second error's dismiss button
    await user.click(dismissButtons[1]);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it('should render dismiss button for each error', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Error 1', type: 'error' },
      { id: 2, message: 'Error 2', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={vi.fn()} />);

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss error/i });
    expect(dismissButtons).toHaveLength(2);
  });

  it('should use unique keys for each error item', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Error 1', type: 'error' },
      { id: 2, message: 'Error 2', type: 'error' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    const notifications = container.querySelectorAll('.error-notification');
    expect(notifications).toHaveLength(2);
  });

  it('should handle success type errors', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Success message', type: 'success' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    const notification = container.querySelector('.error-notification');
    expect(notification).toHaveClass('success');
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should handle warning type errors', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Warning message', type: 'warning' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    const notification = container.querySelector('.error-notification');
    expect(notification).toHaveClass('warning');
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should render error container with correct class', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test', type: 'error' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    expect(container.querySelector('.error-container')).toBeInTheDocument();
  });

  it('should display dismiss button text as ×', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton.textContent).toBe('×');
  });

  it('should have accessible dismiss button with aria-label', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
  });

  it('should render message inside span with correct class', () => {
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test message', type: 'error' },
    ];

    const { container } = render(
      <ErrorNotification errors={errors} onDismiss={vi.fn()} />
    );

    const messageSpan = container.querySelector('.error-message');
    expect(messageSpan).toBeInTheDocument();
    expect(messageSpan?.textContent).toBe('Test message');
  });

  it('should handle multiple clicks on dismiss button', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const errors: ErrorItem[] = [
      { id: 1, message: 'Test', type: 'error' },
    ];

    render(<ErrorNotification errors={errors} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });

    await user.click(dismissButton);
    await user.click(dismissButton);
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(3);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
