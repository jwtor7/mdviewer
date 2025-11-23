# PDF Export Test Document

This document is designed to test the PDF export functionality, specifically focusing on code blocks and elements that previously showed scroll bars.

## Code Block with Long Lines

Here's a code block with very long lines that should wrap properly without scroll bars:

```javascript
const veryLongFunctionName = (parameterOne, parameterTwo, parameterThree, parameterFour, parameterFive, parameterSix, parameterSeven) => {
  return `This is a very long string that contains lots of text and should wrap properly in the PDF export without showing any scroll bars which would look unprofessional`;
};
```

## Multi-line Code Block

```python
def process_data(input_data, configuration_options, database_connection, logger_instance):
    """
    This function demonstrates a multi-line code block with proper indentation.
    It should maintain formatting while wrapping long lines in the PDF.
    """
    for item in input_data:
        if item.matches_criteria(configuration_options):
            result = database_connection.execute_query("SELECT * FROM very_long_table_name WHERE condition = ?", item.value)
            logger_instance.info(f"Processed item {item.id} with result: {result}")
    return True
```

## Table with Long Content

| Column One | Column Two | Column Three |
|------------|------------|--------------|
| Short | Medium text | This is a very long cell content that should wrap properly within the table cell without causing scroll bars in the PDF export |
| Data | More data | Even more data with a really long URL like https://example.com/very/long/path/to/some/resource/that/might/cause/wrapping/issues |

## Long URLs

This paragraph contains a very long URL that should break properly: https://github.com/jwtor7/mdviewer/blob/main/src/components/MarkdownPreview/MarkdownPreview.tsx?ref=feature-branch-with-very-long-name

## Inline Code

Inline code with long text: `this.is.a.very.long.chain.of.method.calls.that.should.wrap.properly.in.the.pdf.export.without.breaking.the.layout`

## Nested Code in Lists

1. First item with code:
   ```bash
   npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-zip @electron-forge/maker-deb @electron-forge/maker-rpm
   ```

2. Second item with long inline code: `const configuration = { veryLongPropertyName: 'veryLongPropertyValue', anotherLongProperty: true }`

## Test Instructions

When exporting this document to PDF:

1. Open this file in mdviewer
2. Go to File → Export to PDF
3. Save the PDF
4. Open the PDF and verify:
   - ✅ No scroll bars appear in any code blocks
   - ✅ Long lines wrap with proper indentation
   - ✅ Tables display correctly without overflow
   - ✅ URLs break at appropriate points
   - ✅ All content is readable

## Expected Results

All code blocks, tables, and long text should display cleanly without any horizontal or vertical scroll bars. The content should be fully readable in the PDF format.
