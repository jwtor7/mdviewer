import PropTypes from 'prop-types';

export const documentShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  filePath: PropTypes.string,
});

export const viewModePropType = PropTypes.oneOf(['preview', 'code']);
export const themePropType = PropTypes.oneOf(['system', 'light', 'dark']);
