/* vim: set ts=2 sw=2 expandtab : */

$(document).ready(function() {
  var table = $('#ds-table').DataTable( {
    ajax: '/api/list-ds',
    dom: 'Bfrtip',
    columnDefs : [
    {
      targets: 0,
      render: function(data, type, row) {
        return '<a href="/show-ds?id=' + data + '">' + data + '</a>';
      },
    },
    {
      targets: 2,
      render: function(data) {
        return dateFormat(data, 'yyyy-mm-dd HH:MM:ss');
      }
    },
   ],
    buttons: [
      {
        extend: 'selectAll',
        
      },
      {
        extend: 'selectNone',
      },
      {
        extend: 'selected',
        text: 'Remove selected',
        className: 'btn-danger',
        action: function() {
          var sel_rows = $.map(table.rows( { selected: true }).data(), function(obj) {
            return obj[0];
          });
          bootbox.confirm('Are you sure you want to remove ' + sel_rows.length + ' data set(s)?', function(response) { 
            if (!response) {
              return;
            }
            $.ajax( { 
              url: '/api/delete-ds',
              type: 'GET',
              data: { to_remove: JSON.stringify(sel_rows) },
              success: table.ajax.reload,
            }); // end $.ajax
          }); // end bootbox.confirm
        }
      }
    ],
    select: true,
  } );
});


