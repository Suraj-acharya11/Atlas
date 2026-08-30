import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

test('mobile test harness renders', () => {
  const { getByText } = render(<Text>ATLAS mobile</Text>);
  expect(getByText('ATLAS mobile')).toBeTruthy();
});
