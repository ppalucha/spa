/* vim: set ts=2 sw=2 expandtab : */

$(document).ready(function() {

  function enableUpdate() {
    $('#submit-ds').removeClass('hidden');
  } 

  $('#ds-name').change(enableUpdate);
  $('#ds-desc').change(enableUpdate);

  var table_na = $('#not-assigned-awrs-table').DataTable( {
    ajax: {
      url: '/api/list-no-ds-awr',
      data: {
        id: $('#ds_id').text(),
      },
      method: 'GET',
    },
    dom: 'Bfrtip',
    columnDefs : [
    {
      targets: 0,
      render: function(data, type, row) {
        return '<a href="/show-awr?id=' + data + '">' + data + '</a>';
      },
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
        text: 'Add',
        className: 'btn-success',
        action: function() {
          var sel_rows = $.map(table_na.rows( { selected: true }).data(), function(obj) {
            return obj[0];
          });
          $.ajax( {
            url: '/api/assign-awr',
            type: 'POST',
            data: { awrs: JSON.stringify(sel_rows), id: $('#ds_id').text() },
            success: table_na.ajax.reload,
          });
        }
      },
      {
        text: 'Done',
        className: 'btn-primary',
        action: function() {
          $('#assigned-wrapper').removeClass('hidden');
          $('#not-assigned-wrapper').addClass('hidden');
          table_a.ajax.reload();
        }
      },
    ],
    select: true,
  } );

  var table_a = $('#assigned-awrs-table').DataTable( {
    ajax: {
      url: '/api/list-ds-awr',
      data: {
        id: $('#ds_id').text(),
      },
      method: 'GET',
    },
    dom: 'Bfrtip',
    columnDefs : [
    {
      targets: 0,
      render: function(data, type, row) {
        return '<a href="/show-awr?id=' + data + '">' + data + '</a>';
      },
    },
    ],
    buttons: [
      {
        text: 'Add AWR files to data set',
        className: 'btn-success',
        id: 'add-awr-btn',
        action: function() {
          $('#not-assigned-wrapper').removeClass('hidden');
          $('#assigned-wrapper').addClass('hidden');
        },
      },
      'selectAll',
      'selectNone',
      {
        extend: 'selected',
        text: 'Remove from data set',
        className: 'btn-danger',
        id: 'rem-awr-btn',
        action: function() {
          var sel_rows = $.map(table_a.rows( { selected: true }).data(), function(obj) {
            return obj[0];
          });
          $.ajax( {
            url: '/api/unassign-awr',
            type: 'POST',
            data: { awrs: JSON.stringify(sel_rows), id: $('#ds_id').text() },
            success: function() {
              table_a.ajax.reload();
              table_na.ajax.reload();
            }
          });
    },
      },
    ],
    select: true,
  } );

  //table_a.buttons().container()
  //          .appendTo('#assigned-awrs-table_wrapper .col-sm-6:eq(0)');

});


